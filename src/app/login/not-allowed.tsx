"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  not_allowed: "You're signed in with an email that isn't on the list. Sign out and use the invited email.",
  link: "That sign-in link has expired or was already used. Request a new one below.",
};

export function NotAllowedNotice() {
  const error = useSearchParams().get("error");
  if (!error || !MESSAGES[error]) return null;
  return (
    <div className="mb-4 rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-ink">
      {MESSAGES[error]}
      {error === "not_allowed" && (
        <form action="/auth/signout" method="post" className="mt-2">
          <button className="font-medium underline">Sign out</button>
        </form>
      )}
    </div>
  );
}
