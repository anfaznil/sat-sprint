import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, FALLBACK, MODEL, spendAiCall } from "@/lib/ai/claude";
import type { Difficulty } from "@/lib/errors";
import { SKILL_GUIDES } from "./skill-guides";
import { validateQuestion, type NewQuestion } from "./validate";

const BATCH = 3;

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

const SYSTEM = `You write original practice questions for the digital SAT (the adaptive Bluebook version).

Rules:
- Every question must be completely original. Never reproduce or closely paraphrase questions from College Board, Khan Academy, Bluebook, or any prep book. Invent your own passages, numbers, and contexts.
- Match the real digital SAT: Reading and Writing questions have exactly one short passage (or a pair of short texts, or a list of notes) and one question, with four answer choices. Math questions are concise, with four choices, or occasionally a student-produced response.
- Exactly one answer is correct. Wrong choices should be plausible and reflect real mistakes students make (common traps), not filler.
- Write math in plain text with Unicode (x², √, π, ≤, ≥, ½, −). No LaTeX and no markdown. Write tables as plain text rows separated by " | ".
- Solve each question yourself in "work" before writing "answer", and check that no other choice is also correct.

Field rules:
- passage: the passage or context. Use "" for a math question with no separate context.
- stem: the question being asked.
- choices: exactly 4 choices for multiple choice, each without a letter prefix. For a math student-produced response, use [].
- answer: "A", "B", "C", or "D" for multiple choice. For a student-produced response, the exact numeric answer (integer, decimal, or fraction like 7/2).
- explanation: 2–4 sentences a high schooler can follow: why the answer is right and why the most tempting wrong choice is wrong.`;

export async function generateQuestions(opts: {
  skillId: string;
  skillName: string;
  domainName: string;
  section: "math" | "rw";
  difficulty: Difficulty;
  avoidStems: string[];
}): Promise<NewQuestion[]> {
  const client = claude(); // throws before spending a call if the key isn't configured
  await spendAiCall();

  const guide = SKILL_GUIDES[opts.skillId] ?? "";
  const spr =
    opts.section === "math"
      ? "Make at most one of them a student-produced response (choices: []); the rest multiple choice."
      : "All must be multiple choice.";
  const avoid = opts.avoidStems.length
    ? `\n\nDon't repeat these existing questions or their setups:\n${opts.avoidStems.map((s) => `- ${s.slice(0, 140)}`).join("\n")}`
    : "";

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(GeneratedSchema) },
    messages: [
      {
        role: "user",
        content: `Write ${BATCH} ${opts.difficulty} questions.
Section: ${opts.section === "math" ? "Math" : "Reading and Writing"}
Domain: ${opts.domainName}
Skill: ${opts.skillName}
What this skill tests: ${guide}
${spr} Vary the topics and contexts.${avoid}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Question generation returned no usable output (${response.stop_reason}).`);
  }

  const valid: NewQuestion[] = [];
  for (const raw of response.parsed_output.questions) {
    const result = validateQuestion(raw, opts.section);
    if (result.ok) {
      valid.push({ ...result.question, skill_id: opts.skillId, difficulty: opts.difficulty, model: response.model });
    } else {
      console.warn(`Discarded generated question for ${opts.skillId}: ${result.reason}`);
    }
  }
  return valid;
}
