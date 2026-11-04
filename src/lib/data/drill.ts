import "server-only";
import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { rankSkills } from "@/lib/skills";
import { computeStreak } from "@/lib/drill/streak";
import { pickFocusSkills, plannedNewQuestions } from "@/lib/drill/plan";
import { getSkillMap, getSkillResults } from "./skills";
import { countDueErrors } from "./errors";
import { getFocus } from "./settings";

export type DrillSession = { id: string; drill_date: string; started_at: string; completed_at: string | null; planned_new: number };

export async function getFocusSkills() {
  const [{ domains, skills }, results, focus] = await Promise.all([getSkillMap(), getSkillResults(), getFocus()]);
  const { ranked, untested } = rankSkills(domains, skills, results);
  return pickFocusSkills(ranked, untested, focus);
}

// Today's session row, created on first visit with the day's question count fixed.
export async function getTodaySession(userId: string): Promise<DrillSession> {
  const supabase = await createClient();
  const day = today();
  const columns = "id, drill_date, started_at, completed_at, planned_new";
  const existing = await supabase.from("drill_sessions").select(columns).eq("created_by", userId).eq("drill_date", day).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const planned = plannedNewQuestions(await countDueErrors(await getFocus()), day);
  const { error } = await supabase
    .from("drill_sessions")
    .upsert({ drill_date: day, planned_new: planned }, { onConflict: "created_by,drill_date", ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: readError } = await supabase.from("drill_sessions").select(columns).eq("created_by", userId).eq("drill_date", day).single();
  if (readError) throw readError;
  return data;
}

// Today's drill session, if she has started one (never creates it).
export async function findTodaySession(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drill_sessions")
    .select("id, drill_date, started_at, completed_at, planned_new")
    .eq("created_by", userId)
    .eq("drill_date", today())
    .maybeSingle();
  if (error) throw error;
  return data as DrillSession | null;
}

// Light review days have no module: finishing the reviews completes the day.
export async function completeTodaySession(userId: string) {
  const supabase = await createClient();
  const session = await getTodaySession(userId);
  if (!session.completed_at) {
    await supabase.from("drill_sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id);
  }
}

export async function countAnswered(sessionId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("question_attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if (error) throw error;
  return count ?? 0;
}

// Days that count toward the streak: a finished drill, or a logged practice test (Saturdays).
export async function getActiveDays(userId: string) {
  const supabase = await createClient();
  const since = addDays(today(), -120);
  const [drills, tests] = await Promise.all([
    supabase.from("drill_sessions").select("drill_date").eq("created_by", userId).not("completed_at", "is", null).gte("drill_date", since),
    supabase.from("practice_tests").select("taken_on").gte("taken_on", since),
  ]);
  if (drills.error) throw drills.error;
  if (tests.error) throw tests.error;
  return {
    drillDays: drills.data.map((d) => d.drill_date as string),
    testDays: tests.data.map((t) => t.taken_on as string),
  };
}

export async function getStreak(userId: string) {
  const { drillDays, testDays } = await getActiveDays(userId);
  return computeStreak([...drillDays, ...testDays], today());
}
