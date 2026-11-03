import { ClipboardList, Leaf, Target, Zap, type LucideIcon } from "lucide-react";
import { addDays, daysBetween, TEST_DATE } from "@/lib/dates";

export type DayKind = "drill" | "practice" | "light" | "test";
export type PlanDay = { date: string; kind: DayKind; note?: string };

const LIGHT_DAYS = 2;

function weekday(day: string) {
  return new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
}

export function isLightDay(day: string) {
  const left = daysBetween(day, TEST_DATE);
  return left >= 1 && left <= LIGHT_DAYS;
}

export function dayKind(day: string): DayKind {
  if (day === TEST_DATE) return "test";
  if (isLightDay(day)) return "light";
  if (weekday(day) === 6) return "practice";
  return "drill";
}

// Every day from the Monday of this week through test day, grouped into Monday-start weeks.
export function buildPlan(today: string): { weekOf: string; days: PlanDay[] }[] {
  const start = addDays(today, -((weekday(today) + 6) % 7));
  const weeks: { weekOf: string; days: PlanDay[] }[] = [];
  for (let day = start; day <= TEST_DATE; day = addDays(day, 1)) {
    if (weeks.length === 0 || weekday(day) === 1) weeks.push({ weekOf: day, days: [] });
    const kind = dayKind(day);
    const note =
      kind === "drill" && weekday(day) === 0 && dayKind(addDays(day, -1)) === "practice"
        ? "Log yesterday's misses first"
        : undefined;
    weeks.at(-1)!.days.push({ date: day, kind, note });
  }
  return weeks;
}

export const DAY_LABEL: Record<DayKind, { title: string; detail: string; icon: LucideIcon }> = {
  drill: { title: "Daily drill", detail: "Reviews + new questions, ~30 min", icon: Zap },
  practice: { title: "Full practice test", detail: "Bluebook, timed, in one sitting, then log results", icon: ClipboardList },
  light: { title: "Light review only", detail: "Error-log reviews and grammar cards. No new material.", icon: Leaf },
  test: { title: "SAT day!", detail: "You've got this.", icon: Target },
};
