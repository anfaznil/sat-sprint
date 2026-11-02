import type { Difficulty } from "@/lib/errors";
import type { Domain, Skill, SkillStat } from "@/lib/skills";
import { isLightDay } from "@/lib/plan";

export type FocusSkill = { skill: Skill; domain: Domain; accuracy: number | null };

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

// About 30 minutes: due reviews first, then new questions. Fewer new ones on heavy review
// days, and none in the final two days before the test (light review only).
export function plannedNewQuestions(dueReviews: number, day: string) {
  if (isLightDay(day)) return 0;
  return Math.min(15, Math.max(8, 15 - Math.ceil(dueReviews / 2)));
}

// Her 3 weakest skills. With little test data, fill with untested skills from the
// biggest domains, alternating sections so both get practice.
export function pickFocusSkills(
  ranked: SkillStat[],
  untested: { skill: Skill; domain: Domain }[],
  count = 3,
): FocusSkill[] {
  const focus: FocusSkill[] = ranked.slice(0, count).map((s) => ({ skill: s.skill, domain: s.domain, accuracy: s.accuracy }));
  if (focus.length >= count) return focus;

  const bySection = (section: "math" | "rw") =>
    untested.filter((u) => u.domain.section === section).sort((a, b) => b.domain.weight - a.domain.weight || a.skill.sort - b.skill.sort);
  const queues = { math: bySection("math"), rw: bySection("rw") };
  let section: "math" | "rw" = focus.filter((f) => f.domain.section === "math").length > focus.length / 2 ? "rw" : "math";
  while (focus.length < count && (queues.math.length || queues.rw.length)) {
    const next = queues[section].shift() ?? queues[section === "math" ? "rw" : "math"].shift();
    if (next) focus.push({ ...next, accuracy: null });
    section = section === "math" ? "rw" : "math";
  }
  return focus;
}

// Start from her test accuracy, then let recent drill results nudge it up or down.
export function pickDifficulty(testAccuracy: number | null, recentDrill: boolean[]): Difficulty {
  let level = testAccuracy === null ? 1 : testAccuracy < 0.5 ? 0 : testAccuracy < 0.75 ? 1 : 2;
  const recent = recentDrill.slice(0, 4);
  if (recent.length >= 3) {
    const rate = recent.filter(Boolean).length / recent.length;
    if (rate >= 0.75) level++;
    else if (rate <= 0.25) level--;
  }
  return DIFFICULTY_ORDER[Math.max(0, Math.min(2, level))];
}
