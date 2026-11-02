import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Member = {
  id: string;
  email: string;
  displayName: string;
  role: "student" | "coach";
};

// Data access layer: the signed-in user, but only if their email is on the allowlist.
export const getMember = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !claims.email) return null;

  // RLS only returns app_users rows to members, so a row here means "allowed".
  const { data: row } = await supabase
    .from("app_users")
    .select("display_name, role")
    .eq("email", claims.email.toLowerCase())
    .maybeSingle();
  if (!row) return null;

  return { id: claims.sub, email: claims.email, displayName: row.display_name, role: row.role };
});

export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/login?error=not_allowed");
  return member;
}
