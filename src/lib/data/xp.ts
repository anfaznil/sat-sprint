import "server-only";
import { createClient } from "@/lib/supabase/server";
import { totalXp, type XpCounts } from "@/lib/xp";

export async function getXp() {
  const supabase = await createClient();
  const count = async (table: string, apply: (q: ReturnType<typeof base>) => ReturnType<typeof base> = (q) => q) => {
    const { count: n, error } = await apply(base(table));
    if (error) throw error;
    return n ?? 0;
  };
  function base(table: string) {
    return supabase.from(table).select("*", { count: "exact", head: true });
  }

  const [drillRight, drillTotal, reviewRight, reviewTotal, drillsCompleted, missesLogged, practiceTests, cardsStarted, cardsMastered] =
    await Promise.all([
      count("question_attempts", (q) => q.eq("correct", true)),
      count("question_attempts"),
      count("error_reviews", (q) => q.eq("correct", true)),
      count("error_reviews"),
      count("drill_sessions", (q) => q.not("completed_at", "is", null)),
      count("error_log", (q) => q.is("question_id", null)), // logged by hand; drill misses save themselves
      count("practice_tests"),
      count("flashcard_state"),
      count("flashcard_state", (q) => q.not("cleared_at", "is", null)),
    ]);

  const counts: XpCounts = {
    drillRight,
    drillWrong: drillTotal - drillRight,
    reviewRight,
    reviewWrong: reviewTotal - reviewRight,
    drillsCompleted,
    missesLogged,
    practiceTests,
    cardsStarted,
    cardsMastered,
  };
  return totalXp(counts);
}
