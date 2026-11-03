"use client";

import { useState, useTransition } from "react";
import { REASONS, reasonInfo, type Reason } from "@/lib/errors";
import { tagError } from "../actions";

// Shows why she missed it, with one-tap chips to tag or change it.
export function TagReason({ id, reason: initial }: { id: string; reason: Reason | null }) {
  const [reason, setReason] = useState(initial);
  const [editing, setEditing] = useState(initial === null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(next: Reason) {
    const previous = reason;
    setReason(next);
    setEditing(false);
    setFailed(false);
    startTransition(async () => {
      try {
        await tagError(id, next);
      } catch {
        setReason(previous);
        setEditing(true);
        setFailed(true);
      }
    });
  }

  if (!editing) {
    return (
      <p className="text-sm">
        {reasonInfo(reason).icon} <strong>{reasonInfo(reason).label}</strong>{" "}
        <button type="button" className="text-muted underline" onClick={() => setEditing(true)} disabled={pending}>
          change
        </button>
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Why did you miss it?</p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(REASONS) as Reason[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => choose(r)}
            aria-pressed={reason === r}
            className={`rounded-xl border p-2.5 text-left text-sm ${reason === r ? "border-accent bg-accent-soft" : "border-line"}`}
          >
            {REASONS[r].icon} {REASONS[r].label}
          </button>
        ))}
      </div>
      {failed && <p className="mt-1 text-xs text-bad">Couldn&apos;t save. Try again.</p>}
    </div>
  );
}
