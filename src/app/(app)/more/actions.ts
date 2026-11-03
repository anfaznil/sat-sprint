"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Focus } from "@/lib/skills";

// Returns the problem instead of throwing: production React hides thrown messages.
export async function setFocus(focus: Focus): Promise<{ error?: string }> {
  await requireMember();
  if (!["both", "rw", "math"].includes(focus)) return { error: "Unknown focus." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, focus_section: focus, updated_at: new Date().toISOString() });
  if (error) {
    console.error("setFocus failed", error);
    const missingTable = error.code === "PGRST205" || error.code === "42P01";
    return {
      error: missingTable
        ? "The focus setting isn't set up yet. Run migration 0007_section_focus.sql in the Supabase SQL Editor, then try again."
        : `Couldn't save (${error.code ?? "unknown error"}). Try again in a moment.`,
    };
  }
  revalidatePath("/", "layout");
  return {};
}
