import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AiLimitError, AiUnavailableError, claude, FALLBACK, MODEL, spendAiCall } from "@/lib/ai/claude";
import { buildOpening, openingContent, TUTOR_SYSTEM } from "@/lib/tutor/context";

const MAX_FOLLOW_UPS = 6;
const MAX_LENGTH = 500;

type Row = { role: "user" | "assistant"; content: string; blocks: Anthropic.Beta.BetaContentBlockParam[] | null };

// Streams the tutor's reply as plain text. Without `message`, it answers the opening
// "why was I wrong?"; with one, it's a follow-up in the same thread.
export async function POST(request: NextRequest) {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Signed out. Reload to sign in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const threadId = typeof body.threadId === "string" ? body.threadId : "";
  const followUp = typeof body.message === "string" ? body.message.trim().slice(0, MAX_LENGTH) : "";

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("tutor_threads")
    .select("id, error_id, question_id")
    .eq("id", threadId)
    .eq("created_by", member.id)
    .maybeSingle();
  if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const { data: rows } = await supabase
    .from("tutor_messages")
    .select("role, content, blocks")
    .eq("thread_id", thread.id)
    .order("created_at");
  const history = (rows ?? []) as Row[];

  // A retry (no new text) re-answers the last unanswered turn, e.g. after a dropped connection.
  const unanswered = history.length === 0 || history.at(-1)?.role === "user";
  if (!followUp && !unanswered) return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  if (history.filter((r) => r.role === "user").length > MAX_FOLLOW_UPS) {
    return NextResponse.json({ error: "That's a lot of follow-ups! Try logging a fresh miss or asking about a new question." }, { status: 429 });
  }

  const target = thread.error_id ? { kind: "error" as const, id: thread.error_id } : { kind: "question" as const, id: thread.question_id! };
  const opening = await buildOpening(target, member.id);
  if (!opening) return NextResponse.json({ error: "That question no longer exists." }, { status: 404 });

  let client: Anthropic;
  try {
    client = claude();
    await spendAiCall();
  } catch (e) {
    if (e instanceof AiLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    if (e instanceof AiUnavailableError) return NextResponse.json({ error: "The tutor isn't set up yet (missing ANTHROPIC_API_KEY)." }, { status: 503 });
    throw e;
  }

  // Append-only conversation: the stored opening text (with the screenshot, if any),
  // then every turn exactly as stored. Assistant turns replay their raw content blocks.
  const openingText = history[0]?.content ?? opening.text;
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: await openingContent(openingText, opening.imagePath) },
    ...history.slice(1).map((r): Anthropic.Beta.BetaMessageParam => ({ role: r.role, content: r.blocks ?? r.content })),
  ];
  if (followUp) messages.push({ role: "user", content: followUp });

  // Save the user's turn before streaming so a dropped connection doesn't lose it.
  const toInsert = history.length === 0 ? [{ thread_id: thread.id, role: "user", content: opening.text }] : [];
  if (followUp) toInsert.push({ thread_id: thread.id, role: "user", content: followUp });
  if (toInsert.length) await supabase.from("tutor_messages").insert(toInsert);

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    betas: [...FALLBACK.betas, "thinking-binding-controls-2026-08-01"],
    // If a stored turn ever stops matching, drop stale reasoning instead of failing.
    thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
    output_config: { effort: "medium" },
    system: TUTOR_SYSTEM,
    messages,
  });

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          open = false; // she navigated away; keep going so the reply is still saved
        }
      };
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send(event.delta.text);
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send("\n\nSorry, I can't help with that one. Try asking a different way.");
        } else {
          const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
          await supabase.from("tutor_messages").insert({
            thread_id: thread.id,
            role: "assistant",
            content: text,
            blocks: final.content,
          });
        }
      } catch (e) {
        console.error("Tutor stream failed", e);
        send("\n\n(Connection hiccup. Tap “Ask again” to retry.)");
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(body$, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
