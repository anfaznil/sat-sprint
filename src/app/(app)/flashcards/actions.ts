"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { applyReview, firstReview, type Stage } from "@/lib/spaced";

export type CardResult = {
  correct: boolean;
  answer: string;
  rule: { front: string; back: string };
  // Where the rule goes next: "tomorrow", "in 3 days", … or "mastered".
  next: string;
};

// Grades a grammar-card question on the server (the answer key never reaches the phone
// before she answers) and moves the rule along the 1 → 3 → 7 day schedule.
// A rule she gets right the first time she sees it skips ahead to the 3-day step.
export async function answerFlashcard(questionId: string, chosen: string): Promise<CardResult> {
  await requireMember();
  const supabase = await createClient();
  const now = today();

  const { data: q, error } = await supabase
    .from("flashcard_questions")
    .select("card_id, answer, flashcards(front, back)")
    .eq("id", questionId)
    .single();
  if (error) throw error;
  const correct = q.answer === chosen;
  const rule = q.flashcards as unknown as { front: string; back: string };

  const { data: state } = await supabase
    .from("flashcard_state")
    .select("stage, next_review_on, cleared_at, reviews")
    .eq("card_id", q.card_id)
    .maybeSingle();

  let next = "";
  if (!state) {
    const stage = correct ? 2 : 1;
    const nextReviewOn = correct ? applyReview(1, true, now).nextReviewOn! : firstReview(now);
    const { error: insertError } = await supabase
      .from("flashcard_state")
      .insert({ card_id: q.card_id, stage, next_review_on: nextReviewOn, reviews: 1 });
    if (insertError) throw insertError;
    next = correct ? "in 3 days" : "tomorrow";
  } else if (!state.cleared_at && state.next_review_on <= now) {
    const outcome = applyReview(state.stage as Stage, correct, now);
    const { error: updateError } = await supabase
      .from("flashcard_state")
      .update({
        reviews: state.reviews + 1,
        ...(outcome.cleared
          ? { cleared_at: new Date().toISOString() }
          : { stage: outcome.stage, next_review_on: outcome.nextReviewOn }),
      })
      .eq("card_id", q.card_id);
    if (updateError) throw updateError;
    next = outcome.cleared ? "mastered" : outcome.stage === 1 ? "tomorrow" : outcome.stage === 2 ? "in 3 days" : "in 7 days";
  }
  // (A repeat tap on a rule that's already been graded today changes nothing.)

  revalidatePath("/flashcards");
  return { correct, answer: q.answer, rule, next };
}
