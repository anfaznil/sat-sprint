import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export type Member = { id: string; displayName: string };

// Passcode mode has one student. Every row is stored under this id (see migration 0006).
export const STUDENT_ID = "00000000-0000-0000-0000-0000000a1ee0";

// Data access layer: the student, if this browser has unlocked the app with the passcode.
export const getMember = cache(async (): Promise<Member | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySession(cookie))) return null;
  return { id: STUDENT_ID, displayName: process.env.STUDENT_NAME || "Aleena" };
});

export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/login");
  return member;
}
