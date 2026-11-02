"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, passcodeMatches, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export type UnlockState = { error?: string };

export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const attempt = String(formData.get("passcode") ?? "");
  if (!(await passcodeMatches(attempt))) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 1500));
    return { error: "That's not it. Check with whoever set up the app." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect("/");
}
