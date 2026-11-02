"use client";

import { useActionState, useState } from "react";
import { sendLink, verifyCode, type LoginState } from "./actions";

export function LoginForm() {
  const [sent, sendAction, sending] = useActionState(sendLink, { step: "email", email: "" } as LoginState);
  const [verify, verifyAction, verifying] = useActionState(verifyCode, {});
  // The result the student backed out of ("different email"); a new send result replaces it.
  const [dismissed, setDismissed] = useState<LoginState | null>(null);

  if (sent.step === "code" && sent !== dismissed) {
    return (
      <div className="space-y-5">
        <p className="text-ink">
          Check <strong>{sent.email}</strong>. Tap the link in the email, or type the code here.
        </p>
        <form action={verifyAction} className="space-y-4">
          <input type="hidden" name="email" value={sent.email} />
          <label className="block">
            <span className="text-sm font-medium text-muted">Code from the email</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className="field mt-1 text-center text-2xl tracking-[0.4em]"
              placeholder="••••••"
            />
          </label>
          {verify.error && <p className="text-sm text-bad">{verify.error}</p>}
          <button className="btn-primary w-full" disabled={verifying}>
            {verifying ? "Checking…" : "Sign in"}
          </button>
        </form>
        <button type="button" className="text-sm text-muted underline" onClick={() => setDismissed(sent)}>
          Use a different email or resend
        </button>
      </div>
    );
  }

  return (
    <form action={sendAction} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-muted">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={sent.email}
          className="field mt-1"
          placeholder="you@example.com"
        />
      </label>
      {sent.step === "email" && sent.error && <p className="text-sm text-bad">{sent.error}</p>}
      <button className="btn-primary w-full" disabled={sending}>
        {sending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
