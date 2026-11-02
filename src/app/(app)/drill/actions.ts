"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { firstReview } from "@/lib/spaced";
import { REASONS } from "@/lib/errors";
import { isCorrect } from "@/lib/drill/validate";
import { countAnswered, getTodaySession } from "@/lib/data/drill";

export type AnswerResult = {
  correct: boolean;
  answer: string;
  explanation: string;
  answered: number;
  planned: number;
  completed: boolean;
};

export async function answerQuestion(questionId: string, chosen: string, seconds: number): Promise<AnswerResult> {
  const member = await requireMember();
  const supabase = await createClient();
  const session = await getTodaySession(member.id);

  const { data: q, error } = await supabase
    .from("questions")
    .select("answer, explanation, choices")
    .eq("id", questionId)
    .single();
  if (error) throw error;

  const correct = isCorrect(q.answer, chosen, q.choices !== null);
  // A double tap must not count twice.
  const { data: prior } = await supabase
    .from("question_attempts")
    .select("id")
    .eq("session_id", session.id)
    .eq("question_id", questionId)
    .maybeSingle();
  if (!prior) {
    const { error: insertError } = await supabase.from("question_attempts").insert({
      question_id: questionId,
      session_id: session.id,
      chosen: chosen.slice(0, 50),
      correct,
      seconds: Math.max(0, Math.min(3600, Math.round(seconds))),
    });
    if (insertError) throw insertError;
  }

  const answered = await countAnswered(session.id);
  let completed = Boolean(session.completed_at);
  if (!completed && answered >= session.planned_new) {
    await supabase.from("drill_sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id);
    completed = true;
    revalidatePath("/", "layout");
  }
  return { correct, answer: q.answer, explanation: q.explanation, answered, planned: session.planned_new, completed };
}

// A wrong drill answer goes into the error log so it comes back for spaced review.
export async function logDrillMiss(questionId: string, chosen: string, reason: keyof typeof REASONS) {
  await requireMember();
  if (!(reason in REASONS)) throw new Error("Unknown reason");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("error_log")
    .select("id")
    .eq("question_id", questionId)
    .is("cleared_at", null)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data: q, error } = await supabase
    .from("questions")
    .select("skill_id, difficulty, passage, stem, choices, answer, skills(domains(section))")
    .eq("id", questionId)
    .single();
  if (error) throw error;

  const section = (q.skills as unknown as { domains: { section: "math" | "rw" } }).domains.section;
  const choices = (q.choices as string[] | null)?.map((c, i) => `${"ABCD"[i]}) ${c}`).join("\n");
  const text = [q.passage, q.stem, choices].filter(Boolean).join("\n\n");

  const { data: row, error: insertError } = await supabase
    .from("error_log")
    .insert({
      section,
      skill_id: q.skill_id,
      difficulty: q.difficulty,
      question_text: text,
      her_answer: chosen,
      correct_answer: q.answer,
      reason,
      question_id: questionId,
      next_review_on: firstReview(today()),
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  revalidatePath("/", "layout");
  return { id: row.id };
}
