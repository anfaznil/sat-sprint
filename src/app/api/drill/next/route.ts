import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { nextQuestion } from "@/lib/drill/next";

// A route handler, not a server action: server actions run one at a time, so prefetching
// the next question (which may take a while to generate) would block answering this one.
export async function POST(request: NextRequest) {
  const member = await getMember();
  if (!member) return NextResponse.json({ status: "error", message: "Signed out. Reload to sign in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const slot = Number(body.slot);
  const exclude = Array.isArray(body.exclude) ? body.exclude.filter((x: unknown) => typeof x === "string").slice(0, 5) : [];
  if (!Number.isInteger(slot) || slot < 0) return NextResponse.json({ status: "error", message: "Bad request" }, { status: 400 });

  return NextResponse.json(await nextQuestion(member, slot, exclude));
}
