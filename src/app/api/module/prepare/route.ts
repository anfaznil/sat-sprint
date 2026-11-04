import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { prepareStep } from "@/lib/data/modules";

// Writing and checking a batch of questions can take a while; give each step room.
export const maxDuration = 300;

// One preparation step for a module. A route handler (not a server action) so the client
// can run several lanes in parallel; server actions run one at a time.
export async function POST(request: NextRequest) {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Locked. Reload and enter the passcode." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const moduleId = typeof body.moduleId === "string" && /^[0-9a-f-]{36}$/.test(body.moduleId) ? body.moduleId : null;
  const lane = Number.isInteger(body.lane) ? Math.max(0, Math.min(5, body.lane)) : 0;
  if (!moduleId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  return NextResponse.json(await prepareStep(moduleId, lane));
}
