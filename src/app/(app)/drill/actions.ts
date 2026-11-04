"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { completeTodaySession } from "@/lib/data/drill";

// Light review days (Dec 3–4) have no module; finishing the reviews completes the day.
export async function finishLightDay() {
  const member = await requireMember();
  await completeTodaySession(member.id);
  revalidatePath("/", "layout");
}
