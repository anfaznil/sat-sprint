import { addDays } from "@/lib/dates";

// Spaced review shared by the error log and grammar flashcards.
// Stage 1 is due 1 day after logging (or after a miss), stage 2 three days after
// a correct stage-1 review, stage 3 seven days after that. Correct at stage 3 clears it.
export const STAGE_GAP_DAYS = { 1: 1, 2: 3, 3: 7 } as const;
export type Stage = keyof typeof STAGE_GAP_DAYS;

export type ReviewOutcome =
  | { cleared: true; stage: Stage; nextReviewOn: null }
  | { cleared: false; stage: Stage; nextReviewOn: string };

export function firstReview(today: string): string {
  return addDays(today, STAGE_GAP_DAYS[1]);
}

export function applyReview(stage: Stage, correct: boolean, today: string): ReviewOutcome {
  if (!correct) return { cleared: false, stage: 1, nextReviewOn: addDays(today, STAGE_GAP_DAYS[1]) };
  if (stage === 3) return { cleared: true, stage: 3, nextReviewOn: null };
  const next = (stage + 1) as Stage;
  return { cleared: false, stage: next, nextReviewOn: addDays(today, STAGE_GAP_DAYS[next]) };
}
