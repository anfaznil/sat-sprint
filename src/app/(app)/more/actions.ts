"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Focus } from "@/lib/skills";

export async function setFocus(focus: Focus) {
  await requireMember();
  if (!["both", "rw", "math"].includes(focus)) throw new Error("Unknown focus");
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, focus_section: focus, updated_at: new Date().toISOString() });
  if (error) throw new Error("Couldn't save. Has migration 0007 been run in Supabase?");
  revalidatePath("/", "layout");
}
