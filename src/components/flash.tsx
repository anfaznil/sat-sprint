"use client";

import { useSearchParams } from "next/navigation";

// One-line confirmation after a redirect, e.g. /errors?saved=1.
export function Flash({ param, message }: { param: string; message: string }) {
  if (!useSearchParams().get(param)) return null;
  return <p className="rounded-xl bg-good/10 p-3 text-sm font-medium text-good">✓ {message}</p>;
}
