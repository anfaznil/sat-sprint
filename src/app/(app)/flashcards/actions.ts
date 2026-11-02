"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { applyReview, firstReview, type Stage } from "@/lib/spaced";

// Same 1 → 3 → 7 day rhythm as the error log. A new card's first look counts as
// "logging" it: it comes back tomorrow, then follows the normal stages.
export async function reviewFlashcard(cardId: string, correct: boolean) {
  await requireMember();
  const supabase = await createClient();
  const now = today();

  const { data: state, error } = await supabase
    .from("flashcard_state")
    .select("stage, next_review_on, cleared_at")
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw error;

  if (!state) {
    const { error: insertError } = await supabase
      .from("flashcard_state")
      .insert({ card_id: cardId, stage: 1, next_review_on: firstReview(now) });
    if (insertError) throw insertError;
  } else if (!state.cleared_at && state.next_review_on <= now) {
    const outcome = applyReview(state.stage as Stage, correct, now);
    const { error: updateError } = await supabase
      .from("flashcard_state")
      .update(
        outcome.cleared
          ? { cleared_at: new Date().toISOString() }
          : { stage: outcome.stage, next_review_on: outcome.nextReviewOn },
      )
      .eq("card_id", cardId);
    if (updateError) throw updateError;
  }
  revalidatePath("/flashcards");
}
