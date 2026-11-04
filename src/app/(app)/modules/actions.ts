"use server";

import { requireMember } from "@/lib/auth";
import { saveItem as save, startModule as start, submitModule as submit } from "@/lib/data/modules";

// Thin wrappers: every module action checks the passcode session first, and returns
// errors instead of throwing (production React hides thrown messages).

export async function startModule(moduleId: string): Promise<{ deadline?: string; serverNow?: number; error?: string }> {
  await requireMember();
  try {
    const m = await start(moduleId);
    return { deadline: m.deadline_at ?? undefined, serverNow: Date.now() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start the module." };
  }
}

export async function saveItem(moduleId: string, position: number, patch: { chosen?: string | null; marked?: boolean; addSeconds?: number }) {
  await requireMember();
  try {
    return { ok: await save(moduleId, position, patch) };
  } catch {
    return { ok: false };
  }
}

export async function submitModule(moduleId: string): Promise<{ ok: boolean }> {
  await requireMember();
  try {
    await submit(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("submitModule failed", e);
    return { ok: false };
  }
}
