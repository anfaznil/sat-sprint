"use client";

import { useState, useTransition } from "react";
import type { Focus } from "@/lib/skills";
import { setFocus } from "./actions";

const OPTIONS: { value: Focus; title: string; detail: string }[] = [
  { value: "both", title: "Both sections", detail: "Drills mix Reading & Writing and Math." },
  { value: "rw", title: "Reading & Writing", detail: "Drills, reviews and Home stick to R&W." },
  { value: "math", title: "Math", detail: "Drills, reviews and Home stick to Math." },
];

export function FocusPicker({ current }: { current: Focus }) {
  const [focus, setLocal] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: Focus) {
    if (next === focus) return;
    const previous = focus;
    setLocal(next);
    setError(null);
    startTransition(async () => {
      try {
        await setFocus(next);
      } catch (e) {
        setLocal(previous);
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="space-y-2" aria-busy={pending}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          aria-pressed={focus === o.value}
          className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
            focus === o.value ? "border-accent bg-accent-soft" : "border-line bg-card"
          }`}
        >
          <span
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
              focus === o.value ? "border-accent" : "border-line"
            }`}
          >
            {focus === o.value && <span className="size-2.5 rounded-full bg-accent" />}
          </span>
          <span>
            <span className="block font-medium">{o.title}</span>
            <span className="block text-sm text-muted">{o.detail}</span>
          </span>
        </button>
      ))}
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
