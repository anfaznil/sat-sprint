import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { firstReview } from "@/lib/spaced";
import type { Reason } from "@/lib/errors";

// Adds a generated question she got wrong (or left blank) to the error log, once.
// Returns whether it's in the log.
export async function saveMiss(questionId: string, chosen: string, reason: Reason | null): Promise<boolean> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("error_log")
    .select("id")
    .eq("question_id", questionId)
    .is("cleared_at", null)
    .maybeSingle();
  if (existing) return true;

  const { data: q, error } = await supabase
    .from("questions")
    .select("skill_id, difficulty, passage, stem, choices, answer, skills(domains(section))")
    .eq("id", questionId)
    .single();
  if (error) return false;

  const section = (q.skills as unknown as { domains: { section: "math" | "rw" } }).domains.section;
  const choices = (q.choices as string[] | null)?.map((c, i) => `${"ABCD"[i]}) ${c}`).join("\n");
  const text = [q.passage, q.stem, choices].filter(Boolean).join("\n\n");

  const { error: insertError } = await supabase.from("error_log").insert({
    section,
    skill_id: q.skill_id,
    difficulty: q.difficulty,
    question_text: text,
    her_answer: chosen,
    correct_answer: q.answer,
    reason,
    question_id: questionId,
    next_review_on: firstReview(today()),
  });
  if (insertError) {
    // e.g. migration 0008 not run yet, so an untagged (null reason) miss can't be stored.
    console.error("Saving miss failed", insertError);
    return false;
  }
  revalidatePath("/", "layout");
  return true;
}
