import { addDays } from "@/lib/dates";

// Consecutive days with a completed drill, ending today, or yesterday if today isn't done yet.
export function computeStreak(completedDays: string[], today: string): number {
  const done = new Set(completedDays);
  let day = done.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (done.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
