"use client";

import { useActionState } from "react";
import { unlock } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(unlock, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-muted">Passcode</span>
        <input
          name="passcode"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="field mt-1"
          placeholder="••••••••"
        />
      </label>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Let's go"}
      </button>
      <p className="text-center text-xs text-muted">You only need this once on each device.</p>
    </form>
  );
}
