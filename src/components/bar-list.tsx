import type { LucideIcon } from "lucide-react";
import { Ico } from "@/components/ico";

// Single-series horizontal bars: one accent hue, values in ink, recessive track.
// Exact counts are always printed, so nothing depends on hover (she's on a phone).
export function BarList({ rows, unit = "miss" }: { rows: { label: string; value: number; icon?: LucideIcon }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.value} ${unit}${r.value === 1 ? "" : "es"}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.icon && <Ico icon={r.icon} className="mr-1.5 text-muted" />}
              {r.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{r.value}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-line/70" role="presentation">
            {r.value > 0 && <div className="h-full rounded bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
