import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { prepareStep } from "@/lib/data/modules";

// Re-checks the question bank for a module that couldn't be filled yet.
export async function POST(request: NextRequest) {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Locked. Reload and enter the passcode." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const moduleId = typeof body.moduleId === "string" && /^[0-9a-f-]{36}$/.test(body.moduleId) ? body.moduleId : null;
  if (!moduleId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  return NextResponse.json(await prepareStep(moduleId));
}
