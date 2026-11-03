import { levelFor } from "@/lib/xp";

export function XpBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const { level, into, span } = levelFor(xp);
  const pct = Math.round((into / span) * 100);
  return (
    <section className={compact ? "" : "card p-4"} aria-label={`Level ${level}, ${into} of ${span} XP to the next level`}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">
          <span aria-hidden className="mr-1.5">
            ⭐
          </span>
          Level {level}
        </span>
        <span className="tabular-nums text-muted">
          {into} / {span} XP
        </span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-line/70" role="presentation">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-warn transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      {!compact && <p className="mt-1.5 text-xs text-muted">{span - into} XP to level {level + 1}. Every question counts, right or wrong.</p>}
    </section>
  );
}
