import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Opens (or reopens) the tutor thread for an error-log item or drill question.
// Returns the visible messages; no Claude call happens here.
export async function POST(request: NextRequest) {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Signed out. Reload to sign in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "error" || body.kind === "question" ? body.kind : null;
  const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/.test(body.id) ? body.id : null;
  if (!kind || !id) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const supabase = await createClient();
  const column = kind === "error" ? "error_id" : "question_id";
  const { data: existing } = await supabase
    .from("tutor_threads")
    .select("id")
    .eq(column, id)
    .eq("created_by", member.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let threadId = existing?.id as string | undefined;
  if (!threadId) {
    const { data, error } = await supabase.from("tutor_threads").insert({ [column]: id }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    threadId = data.id as string;
  }

  const { data: messages } = await supabase
    .from("tutor_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at");

  // The first user turn is the generated question context; the student never typed it.
  const visible = (messages ?? []).slice(1);
  return NextResponse.json({ threadId, messages: visible, started: (messages ?? []).length > 0 });
}
