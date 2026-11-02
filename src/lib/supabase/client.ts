import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

// Browser client with the publishable key. It can't read or write any table (RLS); it's
// only used to upload screenshots to a signed upload URL the server hands out.
export function createClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}
