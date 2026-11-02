"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SaveTestState = { error?: string; fieldErrors?: Record<string, string> };

function int(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

export async function saveTest(_prev: SaveTestState, formData: FormData): Promise<SaveTestState> {
  await requireMember();
  const supabase = await createClient();

  const label = String(formData.get("label") ?? "").trim() || "Bluebook practice test";
  const takenOn = String(formData.get("taken_on") ?? "");
  const rwScore = int(formData.get("rw_score"));
  const mathScore = int(formData.get("math_score"));

  const fieldErrors: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) fieldErrors.taken_on = "Pick the date you took it.";
  for (const [key, score] of [["rw_score", rwScore], ["math_score", mathScore]] as const) {
    if (score !== null && !(score >= 200 && score <= 800 && score % 10 === 0)) {
      fieldErrors[key] = "Section scores run 200–800 in steps of 10.";
    }
  }

  const { data: skills, error: skillsError } = await supabase.from("skills").select("id");
  if (skillsError) return { error: skillsError.message };

  const rows: { skill_id: string; correct: number; total: number }[] = [];
  for (const { id } of skills) {
    const correct = int(formData.get(`c_${id}`));
    const total = int(formData.get(`t_${id}`));
    if (correct === null && total === null) continue;
    if (correct === null || total === null || Number.isNaN(correct) || Number.isNaN(total)) {
      fieldErrors[id] = "Fill in both numbers.";
    } else if (total === 0) {
      fieldErrors[id] = "Total must be at least 1.";
    } else if (correct > total) {
      fieldErrors[id] = "Correct can't be more than total.";
    } else {
      rows.push({ skill_id: id, correct, total });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "A few things need fixing (marked in red).", fieldErrors };
  }
  if (rows.length === 0) {
    return { error: "Enter results for at least one skill." };
  }

  const { data: test, error } = await supabase
    .from("practice_tests")
    .insert({ label, taken_on: takenOn, rw_score: rwScore, math_score: mathScore })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: resultsError } = await supabase
    .from("skill_results")
    .insert(rows.map((r) => ({ ...r, test_id: test.id })));
  if (resultsError) {
    await supabase.from("practice_tests").delete().eq("id", test.id);
    return { error: resultsError.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function deleteTest(formData: FormData) {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("practice_tests").delete().eq("id", String(formData.get("id")));
  if (error) throw error;
  revalidatePath("/", "layout");
}
