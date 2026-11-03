"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { applyReview, firstReview, type Stage } from "@/lib/spaced";
import { DIFFICULTIES, REASONS, SCREENSHOT_PATH, type Reason } from "@/lib/errors";

export type LogErrorState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  // Changes after "Save + another" so the form clears; errors carry it forward unchanged.
  formKey?: number;
  justSaved?: boolean;
  keep?: { section: string; skill_id: string; difficulty: string };
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function logError(prev: LogErrorState, formData: FormData): Promise<LogErrorState> {
  await requireMember();
  const supabase = await createClient();

  const section = text(formData, "section");
  const skillId = text(formData, "skill_id");
  const difficulty = text(formData, "difficulty");
  const questionText = text(formData, "question_text");
  const herAnswer = text(formData, "her_answer");
  const correctAnswer = text(formData, "correct_answer");
  const reason = text(formData, "reason");
  const notes = text(formData, "notes");
  const screenshotPath = text(formData, "screenshot_path") || null;
  const again = formData.get("again") === "1";

  const fieldErrors: Record<string, string> = {};
  if (section !== "math" && section !== "rw") fieldErrors.section = "Pick a section.";
  if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) fieldErrors.difficulty = "Pick a difficulty.";
  if (!(reason in REASONS)) fieldErrors.reason = "Why did you miss it?";
  if (!questionText && !screenshotPath) fieldErrors.question_text = "Describe the question or add a screenshot.";
  if (questionText.length > 4000) fieldErrors.question_text = "That's a lot. Keep it under 4,000 characters.";
  if (!herAnswer) fieldErrors.her_answer = "What did you answer?";
  if (!correctAnswer) fieldErrors.correct_answer = "What was the right answer?";
  if (herAnswer.length > 300 || correctAnswer.length > 300) fieldErrors.correct_answer = "Keep answers short.";
  if (screenshotPath && !SCREENSHOT_PATH.test(screenshotPath)) fieldErrors.screenshot = "Upload the screenshot again.";

  const { data: skill } = await supabase.from("skills").select("id, domains(section)").eq("id", skillId).maybeSingle();
  const skillSection = (skill?.domains as unknown as { section: string } | null)?.section;
  if (!skill || skillSection !== section) fieldErrors.skill_id = "Pick the skill.";

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "A few things need fixing (marked in red).", fieldErrors, formKey: prev.formKey, keep: prev.keep };
  }

  const { error } = await supabase.from("error_log").insert({
    section,
    skill_id: skillId,
    difficulty,
    question_text: questionText,
    her_answer: herAnswer,
    correct_answer: correctAnswer,
    reason,
    notes: notes || null,
    screenshot_path: screenshotPath,
    next_review_on: firstReview(today()),
  });
  if (error) return { error: error.message, formKey: prev.formKey, keep: prev.keep };

  revalidatePath("/", "layout");
  if (again) return { formKey: Date.now(), justSaved: true, keep: { section, skill_id: skillId, difficulty } };
  redirect("/errors?saved=1");
}

export async function recordReview(id: string, correct: boolean) {
  await requireMember();
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("error_log")
    .select("stage, next_review_on, cleared_at")
    .eq("id", id)
    .single();
  if (error) throw error;

  const now = today();
  // Ignore double taps and reviews of items that aren't due.
  if (item.cleared_at || item.next_review_on > now) return { stage: item.stage as Stage, cleared: Boolean(item.cleared_at) };

  const outcome = applyReview(item.stage as Stage, correct, now);
  const { error: updateError } = await supabase
    .from("error_log")
    .update(
      outcome.cleared
        ? { cleared_at: new Date().toISOString() }
        : { stage: outcome.stage, next_review_on: outcome.nextReviewOn },
    )
    .eq("id", id);
  if (updateError) throw updateError;

  await supabase.from("error_reviews").insert({ error_id: id, stage: item.stage, correct });
  revalidatePath("/", "layout");
  return { stage: outcome.stage, cleared: outcome.cleared, nextReviewOn: outcome.nextReviewOn };
}

// Tags (or re-tags) why she missed an error-log item.
export async function tagError(id: string, reason: Reason) {
  await requireMember();
  if (!(reason in REASONS)) throw new Error("Unknown reason");
  const supabase = await createClient();
  const { error } = await supabase.from("error_log").update({ reason }).eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

// Screenshots upload straight from the phone to Storage (server actions cap bodies at 1 MB),
// through a one-time signed upload URL that only the unlocked app can get.
export async function prepareScreenshotUpload(
  ext: string,
): Promise<{ path: string; token: string; error?: undefined } | { error: string }> {
  await requireMember();
  if (!["jpg", "png", "webp", "heic"].includes(ext)) return { error: "Use a PNG, JPEG, WebP or HEIC image." };
  const supabase = await createClient();
  const path = `errors/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from("screenshots").createSignedUploadUrl(path);
  if (error) {
    console.error("createSignedUploadUrl failed", error);
    return { error: "Couldn't start the upload. Check that the screenshots bucket exists (migration 0001)." };
  }
  return { path: data.path, token: data.token };
}

// Removes a screenshot she replaced or removed before saving (never one a saved miss uses).
export async function discardScreenshot(path: string) {
  await requireMember();
  if (!SCREENSHOT_PATH.test(path)) return;
  const supabase = await createClient();
  const { data: used } = await supabase.from("error_log").select("id").eq("screenshot_path", path).maybeSingle();
  if (!used) await supabase.storage.from("screenshots").remove([path]);
}

export async function deleteError(formData: FormData) {
  await requireMember();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { data: item } = await supabase.from("error_log").select("screenshot_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("error_log").delete().eq("id", id);
  if (error) throw error;
  if (item?.screenshot_path) await supabase.storage.from("screenshots").remove([item.screenshot_path]);
  revalidatePath("/", "layout");
  redirect("/errors");
}
