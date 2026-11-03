import type { LucideIcon } from "lucide-react";

// One consistent way to draw an icon next to text: inline, sized to the text, hidden from
// screen readers (the text beside it carries the meaning).
export function Ico({ icon: Icon, className = "" }: { icon: LucideIcon; className?: string }) {
  return <Icon aria-hidden className={`inline-block size-[1.1em] shrink-0 align-[-0.15em] ${className}`} strokeWidth={2.2} />;
}
