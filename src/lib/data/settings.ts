import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Focus } from "@/lib/skills";

// Which half of the SAT she's concentrating on. Falls back to "both" if the settings
// table isn't there yet (migration 0007 not run), so the app keeps working.
export const getFocus = cache(async (): Promise<Focus> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("focus_section").eq("id", 1).maybeSingle();
  if (error || !data) return "both";
  return data.focus_section as Focus;
});
