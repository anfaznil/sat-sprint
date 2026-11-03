import type { LucideIcon } from "lucide-react";

const TONES = {
  accent: "bg-accent-soft text-accent",
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  fire: "bg-orange-500/15 text-orange-500",
  muted: "bg-line/70 text-muted",
} as const;

// Large rounded icon for empty states and celebrations.
export function IconTile({ icon: Icon, tone = "accent", size = "md" }: { icon: LucideIcon; tone?: keyof typeof TONES; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-16 rounded-3xl" : "size-14 rounded-2xl";
  const glyph = size === "lg" ? "size-8" : "size-7";
  return (
    <span className={`mx-auto flex items-center justify-center ${box} ${TONES[tone]}`}>
      <Icon aria-hidden className={glyph} strokeWidth={2.2} />
    </span>
  );
}
