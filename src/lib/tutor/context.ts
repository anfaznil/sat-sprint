import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { REASONS, type Reason } from "@/lib/errors";

export type TutorTarget = { kind: "error" | "question"; id: string };

export const TUTOR_SYSTEM = `You are a patient, encouraging SAT tutor helping a high school student who is preparing for the digital SAT.

When the student shares a question they got wrong:
1. Explain the reasoning step by step, in plain language a high schooler can follow.
2. If there is a trap (a tempting wrong answer, a misread, a common mistake), name it and say why it's tempting.
3. End with one short, concrete tip for spotting this kind of question next time.

Keep the whole answer under 200 words. Write math in plain text with Unicode (x², √, ≤), never LaTeX. Use short paragraphs or a short numbered list; no headings. Be warm but not gushing.

For follow-up questions, answer just what was asked, briefly (under 120 words), and stay on this question. If the student asks about something unrelated to SAT prep, gently steer back.`;

const LETTERS = "ABCD";

// The opening message for a thread: the question, her answer, and the correct answer.
// Built only from rows that never change, so the replayed conversation stays identical.
export async function buildOpening(target: TutorTarget, userId: string): Promise<{ text: string; imagePath: string | null } | null> {
  const supabase = await createClient();

  if (target.kind === "error") {
    const { data } = await supabase
      .from("error_log")
      .select("question_text, her_answer, correct_answer, reason, screenshot_path, skills(name)")
      .eq("id", target.id)
      .maybeSingle();
    if (!data) return null;
    const skill = (data.skills as unknown as { name: string }).name;
    const lines = [
      `Skill: ${skill}`,
      data.question_text ? `Question:\n${data.question_text}` : "The question is in the attached screenshot.",
      `My answer: ${data.her_answer}`,
      `Correct answer: ${data.correct_answer}`,
      data.reason ? `I think I missed it because: ${REASONS[data.reason as Reason]?.label ?? data.reason}` : null,
      "Why was I wrong?",
    ];
    return { text: lines.filter(Boolean).join("\n\n"), imagePath: data.screenshot_path };
  }

  const [{ data: q }, { data: attempt }] = await Promise.all([
    supabase.from("questions").select("passage, stem, choices, answer, explanation, skills(name)").eq("id", target.id).maybeSingle(),
    supabase
      .from("question_attempts")
      .select("chosen, correct")
      .eq("question_id", target.id)
      .eq("created_by", userId)
      .order("answered_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!q) return null;
  const choices = (q.choices as string[] | null)?.map((c, i) => `${LETTERS[i]}) ${c}`).join("\n");
  const lines = [
    `Skill: ${(q.skills as unknown as { name: string }).name}`,
    q.passage ? `Passage:\n${q.passage}` : null,
    `Question:\n${q.stem}`,
    choices ? `Choices:\n${choices}` : "(Student-produced response: no choices.)",
    attempt ? `My answer: ${attempt.chosen}` : null,
    `Correct answer: ${q.answer}`,
    `The answer key's explanation: ${q.explanation}`,
    attempt?.correct ? "I got this one right, but explain the reasoning more fully." : "Why was I wrong?",
  ];
  return { text: lines.filter(Boolean).join("\n\n"), imagePath: null };
}

// User content for the opening turn. The screenshot gets a fresh signed URL each time;
// the bytes are identical, which is what the API checks.
export async function openingContent(text: string, imagePath: string | null): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (imagePath) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("screenshots").createSignedUrl(imagePath, 60 * 10);
    if (data?.signedUrl) blocks.push({ type: "image", source: { type: "url", url: data.signedUrl } });
  }
  blocks.push({ type: "text", text });
  return blocks;
}
