import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ERROR_COLUMNS, type ErrorItem } from "@/lib/errors";
import { today } from "@/lib/dates";
import type { Focus } from "@/lib/skills";

export async function getErrors() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("error_log")
    .select(ERROR_COLUMNS)
    .order("next_review_on")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ErrorItem[];
}

// Due reviews, optionally only for the section in focus (the others wait, still scheduled).
export async function getDueErrors(focus: Focus = "both") {
  const supabase = await createClient();
  let query = supabase.from("error_log").select(ERROR_COLUMNS).is("cleared_at", null).lte("next_review_on", today());
  if (focus !== "both") query = query.eq("section", focus);
  const { data, error } = await query.order("next_review_on").order("created_at");
  if (error) throw error;
  return data as unknown as ErrorItem[];
}

export async function countDueErrors(focus: Focus = "both") {
  const supabase = await createClient();
  let query = supabase
    .from("error_log")
    .select("id", { count: "exact", head: true })
    .is("cleared_at", null)
    .lte("next_review_on", today());
  if (focus !== "both") query = query.eq("section", focus);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// Short-lived signed URLs for private screenshots, keyed by storage path.
export async function signScreenshots(paths: (string | null)[]) {
  const wanted = paths.filter((p): p is string => Boolean(p));
  if (wanted.length === 0) return {} as Record<string, string>;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("screenshots").createSignedUrls(wanted, 60 * 60);
  const urls: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return urls;
}
