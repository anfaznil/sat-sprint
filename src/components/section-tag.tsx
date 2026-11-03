import type { Section } from "@/lib/skills";

// Small colored tag so R&W and Math are recognizable at a glance.
export function SectionTag({ section, short = false }: { section: Section; short?: boolean }) {
  const label = section === "rw" ? (short ? "R&W" : "Reading & Writing") : "Math";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${
        section === "rw" ? "bg-rw/12 text-rw" : "bg-math/12 text-math"
      }`}
    >
      {label}
    </span>
  );
}
