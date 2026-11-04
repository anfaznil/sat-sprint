import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, FALLBACK, MODEL, spendAiCall } from "@/lib/ai/claude";
import type { Difficulty } from "@/lib/errors";
import { SKILL_GUIDES, SKILL_STEMS } from "./skill-guides";
import { validateQuestion, type NewQuestion } from "./validate";

const BATCH = 3;
const LEVELS: Difficulty[] = ["easy", "medium", "hard"];

// The schema Claude must fill. `work` comes before `answer` so the model solves the
// question before committing to a key.
const GeneratedSchema = z.object({
  questions: z.array(
    z.object({
      passage: z.string(),
      stem: z.string(),
      choices: z.array(z.string()),
      work: z.string(),
      answer: z.string(),
      explanation: z.string(),
    }),
  ),
});

// What easy / medium / hard mean on the real digital SAT, so generated questions land at
// the same level. (Our own description, not College Board text.)
const DIFFICULTY_GUIDE = `How difficulty works on the digital SAT:

Reading and Writing
- easy: plain, familiar topic; short passage (about 25–60 words); the answer is stated almost directly; wrong choices are clearly off once you reread the text; common vocabulary.
- medium: academic passage (about 60–110 words) from science, history/social studies, humanities or literature; requires connecting two ideas; one wrong choice is genuinely tempting (true but irrelevant, too broad, or reverses the logic).
- hard: dense, formal passage (about 90–150 words) with complex sentences, hedged claims, or an unfamiliar scholarly argument; precise vocabulary (for words in context, a sophisticated but fair word); two choices are close and the difference is subtle (scope, certainty, or what the text actually supports); for grammar, the error is buried in a long sentence with interrupting phrases.

Math
- easy: one step; numbers are friendly; little reading.
- medium: two or three steps or a word problem to translate; one plausible trap (sign error, solving for the wrong quantity).
- hard: multi-step with abstraction (unknown constants, parameters like k, equivalent forms, systems with no or infinite solutions, nonlinear models, geometry with several relationships); the trap answer is what a quick solver gets.

A real hard SAT question is hard because of reasoning, not because of obscure facts or trick wording. Every question must be fair and answerable from the text or math given.`;

const SYSTEM = `You write original practice questions for the digital SAT (the adaptive Bluebook version), at the same difficulty as the real test.

Rules:
- Every question must be completely original. Never reproduce or closely paraphrase questions from College Board, Khan Academy, Bluebook, or any prep book. Invent your own passages, numbers, and contexts.
- Match the real digital SAT: Reading and Writing questions have exactly one short passage (or a pair of short texts, or a list of notes) and one question, with four answer choices, using the SAT's standard question wording. Math questions are concise, with four choices, or sometimes a student-produced response.
- Exactly one answer is correct. Wrong choices are plausible and reflect real mistakes students make, not filler.
- Write math in plain text with Unicode (x², √, π, ≤, ≥, ½, −). No LaTeX and no markdown. Write tables as plain text rows separated by " | ".
- Solve each question yourself in "work" before writing "answer", and check that no other choice is also correct.

${DIFFICULTY_GUIDE}

Field rules:
- passage: the passage or context. Use "" for a math question with no separate context.
- stem: the question being asked.
- choices: exactly 4 choices for multiple choice, each without a letter prefix. For a math student-produced response, use [].
- answer: "A", "B", "C", or "D" for multiple choice. For a student-produced response, the exact numeric answer (integer, decimal, or fraction like 7/2).
- explanation: 2–4 sentences a high schooler can follow: why the answer is right and why the most tempting wrong choice is wrong.`;

// The checker never sees the answer key: it solves each question cold and rates it.
const VerifySchema = z.object({
  results: z.array(
    z.object({
      work: z.string(),
      answer: z.string(),
      exactly_one_correct: z.boolean(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      problems: z.string(),
    }),
  ),
});

const VERIFY_SYSTEM = `You are a strict reviewer of SAT practice questions. For each question, solve it from scratch, then report:
- answer: your answer ("A"–"D", or the numeric value for a student-produced response)
- exactly_one_correct: false if two choices are defensible, none is right, or the question is unclear or unfair
- difficulty: how it compares with real digital SAT questions of this type (easy, medium, or hard)
- problems: anything wrong (factual errors, typos, ambiguity, not SAT-like), or "" if none

${DIFFICULTY_GUIDE}`;

type GenOpts = {
  skillId: string;
  skillName: string;
  domainName: string;
  section: "math" | "rw";
  difficulty: Difficulty;
  avoidStems: string[];
};

// Writes a batch of questions, then keeps only the ones a blind second pass solves to
// the same answer and judges fair. Each kept question is stored at the difficulty the
// checker rated it, which calibrates the bank against a second opinion.
export async function generateQuestions(opts: GenOpts): Promise<NewQuestion[]> {
  const client = claude(); // throws before spending a call if the key isn't configured
  await spendAiCall();

  const guide = SKILL_GUIDES[opts.skillId] ?? "";
  const stem = SKILL_STEMS[opts.skillId];
  const format =
    opts.section === "math"
      ? "Make at most one of them a student-produced response (choices: []); the rest multiple choice."
      : `All must be multiple choice.${stem ? ` Use the SAT's standard question wording: "${stem}"` : ""}`;
  const avoid = opts.avoidStems.length
    ? `\n\nDon't repeat these existing questions or their setups:\n${opts.avoidStems.map((s) => `- ${s.slice(0, 140)}`).join("\n")}`
    : "";

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    system: SYSTEM,
    output_config: { effort: "high", format: betaZodOutputFormat(GeneratedSchema) },
    messages: [
      {
        role: "user",
        content: `Write ${BATCH} ${opts.difficulty.toUpperCase()} questions, at real digital SAT ${opts.difficulty} difficulty.
Section: ${opts.section === "math" ? "Math" : "Reading and Writing"}
Domain: ${opts.domainName}
Skill: ${opts.skillName}
What this skill tests: ${guide}
${format} Vary the topics and contexts.${avoid}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Question generation returned no usable output (${response.stop_reason}).`);
  }

  const drafts: NewQuestion[] = [];
  for (const raw of response.parsed_output.questions) {
    const result = validateQuestion(raw, opts.section);
    if (result.ok) {
      drafts.push({ ...result.question, skill_id: opts.skillId, difficulty: opts.difficulty, model: response.model });
    } else {
      console.warn(`Discarded generated question for ${opts.skillId}: ${result.reason}`);
    }
  }
  if (drafts.length === 0) return [];
  return verify(client, drafts, opts);
}

async function verify(client: ReturnType<typeof claude>, drafts: NewQuestion[], opts: GenOpts): Promise<NewQuestion[]> {
  await spendAiCall();
  const listing = drafts
    .map((q, i) => {
      const choices = q.choices ? q.choices.map((c, j) => `${"ABCD"[j]}) ${c}`).join("\n") : "(student-produced response: give a number)";
      return `Question ${i + 1}\n${q.passage ? `${q.passage}\n\n` : ""}${q.stem}\n${choices}`;
    })
    .join("\n\n---\n\n");

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    system: VERIFY_SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(VerifySchema) },
    messages: [
      {
        role: "user",
        content: `Skill: ${opts.skillName} (${opts.section === "math" ? "Math" : "Reading and Writing"}). Review these ${drafts.length} questions, in order:\n\n${listing}`,
      },
    ],
  });
  const results = response.parsed_output?.results;
  if (response.stop_reason === "refusal" || !results || results.length !== drafts.length) {
    console.warn(`Verification failed for ${opts.skillId}; discarding batch.`);
    return [];
  }

  const kept: NewQuestion[] = [];
  drafts.forEach((q, i) => {
    const r = results[i];
    const sameAnswer = q.choices
      ? r.answer.trim().toUpperCase().replace(/[^A-D]/g, "") === q.answer
      : Math.abs(Number(eval_(r.answer)) - Number(eval_(q.answer))) < 1e-4;
    const levelGap = Math.abs(LEVELS.indexOf(r.difficulty) - LEVELS.indexOf(opts.difficulty));
    if (sameAnswer && r.exactly_one_correct && levelGap <= 1) {
      kept.push({ ...q, difficulty: r.difficulty });
    } else {
      console.warn(
        `Verifier rejected ${opts.skillId} question: answer ${r.answer} vs key ${q.answer}, one-correct ${r.exactly_one_correct}, rated ${r.difficulty} for ${opts.difficulty}. ${r.problems}`,
      );
    }
  });
  return kept;
}

// Numeric value of an answer like "7/2", "3.5" or ".5" (NaN if it isn't a number).
function eval_(s: string) {
  const t = s.replace(/\s/g, "");
  if (/^-?\d+\/\d+$/.test(t)) {
    const [n, d] = t.split("/").map(Number);
    return d === 0 ? NaN : n / d;
  }
  return Number(t);
}
