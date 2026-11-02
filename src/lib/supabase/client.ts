import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

// Browser client, used only for direct-to-Storage uploads (server actions cap bodies at 1 MB).
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
