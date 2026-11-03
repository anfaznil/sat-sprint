export const REASONS = {
  careless: { label: "Careless", hint: "Knew it, slipped up", icon: "🙈" },
  concept_gap: { label: "Concept gap", hint: "Didn't know how", icon: "🧩" },
  timing: { label: "Timing", hint: "Rushed or ran out", icon: "⏱️" },
  trap: { label: "Fell for a trap", hint: "Tempting wrong answer", icon: "🪤" },
} as const;
export type Reason = keyof typeof REASONS;

// Drill misses are saved before she tags them, so a reason can be missing.
export const UNTAGGED = { label: "Not tagged yet", hint: "Tag it to spot patterns", icon: "🏷️" };
export function reasonInfo(reason: Reason | null) {
  return reason ? REASONS[reason] : UNTAGGED;
}

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type ErrorItem = {
  id: string;
  section: "math" | "rw";
  skill_id: string;
  difficulty: Difficulty;
  question_text: string;
  her_answer: string;
  correct_answer: string;
  reason: Reason | null;
  notes: string | null;
  screenshot_path: string | null;
  stage: 1 | 2 | 3;
  next_review_on: string;
  cleared_at: string | null;
  created_at: string;
  skills: { name: string };
};

export const ERROR_COLUMNS =
  "id, section, skill_id, difficulty, question_text, her_answer, correct_answer, reason, notes, screenshot_path, stage, next_review_on, cleared_at, created_at, skills(name)";

// Screenshots live at screenshots/errors/<uuid>.<ext>; anything else is rejected.
export const SCREENSHOT_PATH = /^errors\/[0-9a-f-]{36}\.(jpg|png|webp|heic)$/;
