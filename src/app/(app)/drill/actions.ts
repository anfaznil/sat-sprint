"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { firstReview } from "@/lib/spaced";
import { REASONS, type Reason } from "@/lib/errors";
import { isCorrect } from "@/lib/drill/validate";
import { countAnswered, countCorrect, getTodaySession } from "@/lib/data/drill";

export type AnswerResult = {
  correct: boolean;
  answer: string;
  explanation: string;
  answered: number;
  // Right answers so far in today's drill.
  score: number;
  planned: number;
  completed: boolean;
  // Set when a wrong answer was saved to the error log.
  savedToLog: boolean;
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

  // Every miss goes to the error log right away, so none are lost if she skips tagging it.
  const savedToLog = !correct && (await saveMiss(questionId, chosen, null));

  const [answered, score] = await Promise.all([countAnswered(session.id), countCorrect(session.id)]);
  let completed = Boolean(session.completed_at);
  if (!completed && answered >= session.planned_new) {
    await supabase.from("drill_sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id);
    completed = true;
    revalidatePath("/", "layout");
  }
  return { correct, answer: q.answer, explanation: q.explanation, answered, score, planned: session.planned_new, completed, savedToLog };
}

// Tags why she missed a drill question (saving it first if the automatic save didn't happen).
export async function tagDrillMiss(questionId: string, chosen: string, reason: Reason) {
  await requireMember();
  if (!(reason in REASONS)) throw new Error("Unknown reason");
  const supabase = await createClient();
  const { data: updated } = await supabase
    .from("error_log")
    .update({ reason })
    .eq("question_id", questionId)
    .is("cleared_at", null)
    .select("id");
  if (!updated?.length && !(await saveMiss(questionId, chosen, reason))) throw new Error("Couldn't save the miss");
  revalidatePath("/", "layout");
}

// Adds a drill question she got wrong to the error log, once. Returns whether it's in the log.
async function saveMiss(questionId: string, chosen: string, reason: Reason | null): Promise<boolean> {
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
    console.error("Saving drill miss failed", insertError);
    return false;
  }
  revalidatePath("/", "layout");
  return true;
}
