"use client";

import { Fragment, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

// "Why was I wrong?": opens a tutor thread for an error-log item or drill question,
// streams Claude's explanation, and allows a few follow-up questions.
export function TutorPanel({ kind, id, label = "🤔 Why was I wrong?" }: { kind: "error" | "question"; id: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // "Ask again" re-requests the unanswered opening; a failed follow-up goes back in the input instead.
  const [retryable, setRetryable] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function start() {
    setOpen(true);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor/thread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't open the tutor.");
      setThreadId(data.threadId);
      setMessages(data.messages);
      // No reply yet (new thread, or the last answer never arrived): ask now.
      if (data.messages.length === 0 || data.messages.at(-1).role === "user") await ask(data.threadId);
      else setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the tutor.");
      setBusy(false);
    }
  }

  async function ask(thread = threadId, text?: string) {
    if (!thread) return;
    setBusy(true);
    setError(null);
    setRetryable(false);
    setMessages((m) => [...m, ...(text ? [{ role: "user" as const, content: text }] : []), { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/tutor/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: thread, message: text }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "The tutor couldn't answer just now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m.at(-1)!.content + chunk }]);
      }
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) {
      setMessages((m) => {
        const withoutEmpty = m.at(-1)?.role === "assistant" && !m.at(-1)!.content ? m.slice(0, -1) : m;
        return text ? withoutEmpty.slice(0, -1) : withoutEmpty;
      });
      if (text) setDraft(text);
      else setRetryable(true);
      setError(e instanceof Error ? e.message : "The tutor couldn't answer just now.");
    } finally {
      setBusy(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    ask(threadId, text);
  }

  if (!open) {
    return (
      <button type="button" onClick={start} className="btn-ghost w-full gap-2 text-sm">
        {label}
      </button>
    );
  }

  const waiting = busy && messages.at(-1)?.role === "assistant" && !messages.at(-1)!.content;

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-4">
      <p className="mb-3 text-sm font-semibold text-accent">🧑‍🏫 Tutor</p>
      <div className="space-y-3">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-8 rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-[15px] text-white">
              {m.content}
            </p>
          ) : m.content ? (
            <div key={i} className="whitespace-pre-wrap text-[15px] leading-relaxed">
              <Formatted text={m.content} />
            </div>
          ) : null,
        )}
        {(waiting || (busy && messages.length === 0)) && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="size-4 animate-spin rounded-full border-2 border-accent-soft border-t-accent" />
            Thinking it through…
          </p>
        )}
        {error && (
          <div className="rounded-xl bg-bad/10 p-3 text-sm">
            <p className="text-bad">{error}</p>
            {threadId && retryable && (
              <button type="button" className="mt-1 font-medium underline" onClick={() => ask()}>
                Ask again
              </button>
            )}
          </div>
        )}
        <div ref={bottom} />
      </div>
      {threadId && !busy && messages.some((m) => m.role === "assistant" && m.content) && (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            className="field py-2.5 text-[15px]"
            placeholder="Ask a follow-up…"
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn-primary shrink-0 px-3.5 py-2" disabled={!draft.trim()}>
            Ask
          </button>
        </form>
      )}
    </section>
  );
}

// Light formatting: **bold** only. Everything else is plain text.
function Formatted({ text }: { text: string }) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}
