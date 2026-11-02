import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Domain, ResultRow, Skill } from "@/lib/skills";

export async function getSkillMap() {
  const supabase = await createClient();
  const [domains, skills] = await Promise.all([
    supabase.from("domains").select("id, section, name, weight, sort").order("sort"),
    supabase.from("skills").select("id, domain_id, name, sort").order("sort"),
  ]);
  if (domains.error) throw domains.error;
  if (skills.error) throw skills.error;
  return { domains: domains.data as Domain[], skills: skills.data as Skill[] };
}

export async function getSkillResults() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("skill_results")
    .select("skill_id, correct, total, practice_tests!inner(taken_on, created_at)");
  if (error) throw error;
  return data as unknown as ResultRow[];
}
