import type { Difficulty } from "@/lib/errors";

export type NewQuestion = {
  skill_id: string;
  difficulty: Difficulty;
  passage: string | null;
  stem: string;
  choices: string[] | null;
  answer: string;
  explanation: string;
  model: string;
};

type Raw = { passage: string; stem: string; choices: string[]; answer: string; explanation: string };
type Result = { ok: true; question: Pick<NewQuestion, "passage" | "stem" | "choices" | "answer" | "explanation"> } | { ok: false; reason: string };

const LETTER_PREFIX = /^\s*\(?[A-D][).:]\s+/;
const NUMERIC = /^-?(\d+(\.\d+)?|\.\d+|\d+\/\d+)$/;

// Structural checks before a generated question is saved. Never trust model output blindly.
export function validateQuestion(raw: Raw, section: "math" | "rw"): Result {
  const stem = raw.stem?.trim();
  const passage = raw.passage?.trim() || null;
  const explanation = raw.explanation?.trim();
  const answer = raw.answer?.trim();
  if (!stem || stem.length < 8) return { ok: false, reason: "missing stem" };
  if (stem.length > 600) return { ok: false, reason: "stem too long" };
  if (passage && passage.length > 2000) return { ok: false, reason: "passage too long" };
  if (section === "rw" && (!passage || passage.length < 40)) return { ok: false, reason: "R&W question without a passage" };
  if (!explanation || explanation.length < 20) return { ok: false, reason: "missing explanation" };
  if (/\\(frac|sqrt|times|cdot)|\$\$?/.test(`${passage ?? ""} ${stem}`)) return { ok: false, reason: "LaTeX in text" };

  const choices = (raw.choices ?? []).map((c) => c.replace(LETTER_PREFIX, "").trim());
  if (choices.length === 0) {
    if (section !== "math") return { ok: false, reason: "R&W question must be multiple choice" };
    if (!NUMERIC.test(answer)) return { ok: false, reason: `student-produced answer not numeric: ${answer}` };
    return { ok: true, question: { passage, stem, choices: null, answer, explanation } };
  }

  if (choices.length !== 4) return { ok: false, reason: `expected 4 choices, got ${choices.length}` };
  if (choices.some((c) => !c || c.length > 400)) return { ok: false, reason: "empty or oversized choice" };
  if (new Set(choices.map((c) => c.toLowerCase())).size !== 4) return { ok: false, reason: "duplicate choices" };
  const letter = answer.toUpperCase().replace(/[^A-D]/g, "");
  if (letter.length !== 1) return { ok: false, reason: `answer is not a single letter: ${answer}` };
  return { ok: true, question: { passage, stem, choices, answer: letter, explanation } };
}

// Student-produced responses: accept equivalent forms (7/2, 3.5, 3.50).
export function isCorrect(answer: string, chosen: string, multipleChoice: boolean): boolean {
  const a = answer.trim();
  const c = chosen.trim();
  if (multipleChoice) return a.toUpperCase() === c.toUpperCase();
  const num = (s: string) => {
    const t = s.replace(/\s/g, "");
    if (/^-?\d+\/\d+$/.test(t)) {
      const [n, d] = t.split("/").map(Number);
      return d === 0 ? NaN : n / d;
    }
    return NUMERIC.test(t) ? Number(t) : NaN;
  };
  const x = num(a), y = num(c);
  if (Number.isNaN(x) || Number.isNaN(y)) return a.toLowerCase() === c.toLowerCase();
  return Math.abs(x - y) < 1e-4 * Math.max(1, Math.abs(x));
}
