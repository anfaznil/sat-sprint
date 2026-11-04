"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, Flag, Strikethrough } from "lucide-react";
import type { RunItem } from "@/lib/data/modules";
import { saveItem, submitModule } from "@/app/(app)/modules/actions";

const LETTERS = ["A", "B", "C", "D"];
const FIVE_MINUTES = 5 * 60 * 1000;

type Props = {
  moduleId: string;
  title: string;
  items: RunItem[];
  deadline: string;
  serverNow: number;
};

export function ModuleRunner({ moduleId, title, items: initial, deadline, serverNow }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [index, setIndex] = useState(() => Math.max(0, initial.findIndex((i) => !i.chosen)));
  const [view, setView] = useState<"question" | "review">("question");
  const [navOpen, setNavOpen] = useState(false);
  const [showTimer, setShowTimer] = useState(true);
  const [struck, setStruck] = useState<Record<number, string[]>>({});
  const [submitting, startSubmit] = useTransition();
  const [submitFailed, setSubmitFailed] = useState(false);

  // Clock: the deadline is the server's; correct for the phone's clock being off.
  const offset = useRef(0);
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    offset.current = serverNow - Date.now();
    const id = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(id);
  }, [serverNow]);
  const remaining = Math.max(0, Date.parse(deadline) - now);

  // Time on each question: counted while it's on screen, saved when she leaves it.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);
  const takeSeconds = useCallback(() => {
    const s = (Date.now() - shownAt.current) / 1000;
    shownAt.current = Date.now();
    return s;
  }, []);

  const item = items[index];

  const goTo = useCallback(
    (next: number | "review") => {
      if (view === "question" && item) saveItem(moduleId, item.position, { addSeconds: takeSeconds() });
      else takeSeconds();
      setNavOpen(false);
      if (next === "review") {
        setView("review");
      } else {
        setView("question");
        setIndex(next);
      }
      window.scrollTo({ top: 0 });
    },
    [view, item, moduleId, takeSeconds],
  );

  const submit = useCallback(() => {
    setSubmitFailed(false);
    startSubmit(async () => {
      if (view === "question" && item) await saveItem(moduleId, item.position, { addSeconds: takeSeconds() });
      const r = await submitModule(moduleId);
      if (r.ok) router.replace(`/modules/${moduleId}`);
      else setSubmitFailed(true);
    });
  }, [view, item, moduleId, takeSeconds, router]);

  // Time's up: submit whatever is answered, like the real test.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (remaining === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [remaining, submit]);

  // Warn before closing the tab mid-module (the clock keeps running).
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function choose(value: string | null) {
    setItems((all) => all.map((i, k) => (k === index ? { ...i, chosen: value } : i)));
    if (value) setStruck((s) => ({ ...s, [item.position]: (s[item.position] ?? []).filter((l) => l !== value) }));
    saveItem(moduleId, item.position, { chosen: value });
  }

  function toggleMark() {
    const marked = !item.marked;
    setItems((all) => all.map((i, k) => (k === index ? { ...i, marked } : i)));
    saveItem(moduleId, item.position, { marked });
  }

  function toggleStrike(letter: string) {
    const current = struck[item.position] ?? [];
    const on = !current.includes(letter);
    setStruck((s) => ({ ...s, [item.position]: on ? [...current, letter] : current.filter((l) => l !== letter) }));
    if (on && item.chosen === letter) choose(null);
  }

  const answered = items.filter((i) => i.chosen).length;
  const lowTime = remaining <= FIVE_MINUTES;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2">
          <p className="min-w-0 truncate text-xs font-semibold text-muted">{title}</p>
          <div className="flex items-center gap-1.5">
            {showTimer || lowTime ? (
              <span className={`font-mono text-lg font-bold tabular-nums ${lowTime ? "text-bad" : "text-ink"}`} aria-live="off">
                {clock(remaining)}
              </span>
            ) : (
              <span className="text-xs text-muted">Timer hidden</span>
            )}
            {!lowTime && (
              <button
                type="button"
                onClick={() => setShowTimer((v) => !v)}
                className="rounded-md p-1 text-muted"
                aria-label={showTimer ? "Hide timer" : "Show timer"}
              >
                {showTimer ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>
        </div>
        {lowTime && remaining > 0 && (
          <p className="bg-bad/10 py-1 text-center text-xs font-semibold text-bad">Less than 5 minutes left</p>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-4">
        {view === "review" ? (
          <section className="space-y-5">
            <div className="text-center">
              <h1 className="text-xl font-bold">Check Your Work</h1>
              <p className="mt-1 text-sm text-muted">
                {answered} of {items.length} answered
                {items.some((i) => i.marked) && ` · ${items.filter((i) => i.marked).length} marked for review`}. Tap a
                number to go back to it.
              </p>
            </div>
            <Grid items={items} current={-1} onPick={(k) => goTo(k)} />
            <button className="btn-primary w-full py-3.5" disabled={submitting} onClick={submit}>
              {submitting ? "Submitting…" : "Submit module"}
            </button>
            {submitFailed && <p className="text-center text-sm text-bad">Couldn&apos;t submit. Check your connection and tap again.</p>}
          </section>
        ) : (
          <section className="space-y-3">
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line bg-ink/[0.03] px-4 py-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-ink text-sm font-bold text-bg">{item.position}</span>
                <button
                  type="button"
                  onClick={toggleMark}
                  aria-pressed={item.marked}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${item.marked ? "text-bad" : "text-muted"}`}
                >
                  <Bookmark aria-hidden className={`size-4 ${item.marked ? "fill-bad" : ""}`} />
                  Mark for Review
                </button>
                <span className="flex-1" />
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <Strikethrough aria-hidden className="size-3.5" /> tap to cross out
                </span>
              </div>
              {item.question.passage && (
                <p className="whitespace-pre-wrap border-b border-line px-5 py-5 font-serif text-[17px] leading-[1.7]">{item.question.passage}</p>
              )}
              <p className="whitespace-pre-wrap px-5 py-4 text-[16px] font-semibold leading-relaxed">{item.question.stem}</p>
            </div>

            {item.question.choices ? (
              <ol className="space-y-2">
                {item.question.choices.map((choice, i) => {
                  const letter = LETTERS[i];
                  const selected = item.chosen === letter;
                  const out = (struck[item.position] ?? []).includes(letter);
                  return (
                    <li key={letter} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => choose(selected ? null : letter)}
                        aria-pressed={selected}
                        className={`flex flex-1 items-start gap-3 rounded-xl border-2 bg-card p-3 text-left transition active:scale-[0.99] ${
                          selected ? "border-accent bg-accent-soft" : "border-line"
                        } ${out ? "opacity-45" : ""}`}
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                            selected ? "border-accent bg-accent text-white" : "border-ink/70 text-ink"
                          }`}
                        >
                          {letter}
                        </span>
                        <span className={`whitespace-pre-wrap pt-0.5 text-[15px] leading-snug ${out ? "line-through" : ""}`}>{choice}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStrike(letter)}
                        aria-pressed={out}
                        aria-label={`${out ? "Undo cross out" : "Cross out"} choice ${letter}`}
                        className={`w-10 shrink-0 rounded-xl border-2 text-xs font-bold ${out ? "border-ink/50 text-ink" : "border-line text-muted line-through"}`}
                      >
                        {out ? "Undo" : letter}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <StudentResponse key={item.position} value={item.chosen ?? ""} onChange={(v) => choose(v || null)} />
            )}
          </section>
        )}
      </main>

      {/* Bottom bar */}
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {navOpen && (
          <div className="mx-auto max-w-2xl border-b border-line px-4 py-4">
            <Grid items={items} current={view === "question" ? index : -1} onPick={(k) => goTo(k)} />
            <button className="btn-ghost mt-3 w-full text-sm" onClick={() => goTo("review")}>
              Go to Review Page
            </button>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setNavOpen((o) => !o)}
            className="flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg"
            aria-expanded={navOpen}
          >
            {view === "review" ? "Review" : `Question ${index + 1} of ${items.length}`}
            <ChevronUp aria-hidden className={`size-4 transition ${navOpen ? "" : "rotate-180"}`} />
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className="btn-ghost px-3 py-2"
            disabled={view === "question" && index === 0}
            onClick={() => (view === "review" ? goTo(items.length - 1) : goTo(index - 1))}
            aria-label="Back"
          >
            <ChevronLeft className="size-5" />
          </button>
          {view === "question" && (
            <button
              type="button"
              className="btn-primary px-4 py-2"
              onClick={() => (index + 1 < items.length ? goTo(index + 1) : goTo("review"))}
            >
              Next <ChevronRight aria-hidden className="ml-0.5 size-5" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Grid({ items, current, onPick }: { items: RunItem[]; current: number; onPick: (index: number) => void }) {
  return (
    <div>
      <ol className="grid grid-cols-7 gap-2">
        {items.map((it, k) => (
          <li key={it.position}>
            <button
              type="button"
              onClick={() => onPick(k)}
              aria-label={`Question ${it.position}${it.chosen ? ", answered" : ", unanswered"}${it.marked ? ", marked for review" : ""}`}
              className={`relative flex h-10 w-full items-center justify-center rounded-lg border-2 text-sm font-semibold ${
                it.chosen ? "border-accent bg-accent text-white" : "border-dashed border-ink/40 text-ink"
              } ${k === current ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""}`}
            >
              {it.position}
              {it.marked && <Flag aria-hidden className="absolute -right-1 -top-1.5 size-4 fill-bad text-bad" />}
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded border-2 border-dashed border-ink/40" /> Unanswered
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded bg-accent" /> Answered
        </span>
        <span className="flex items-center gap-1">
          <Flag aria-hidden className="size-3 fill-bad text-bad" /> For review
        </span>
      </p>
    </div>
  );
}

// Math student-produced response: saved shortly after she stops typing.
function StudentResponse({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div className="card space-y-2 p-4">
      <label className="block text-sm font-medium text-muted" htmlFor="spr">
        Your answer
      </label>
      <input
        id="spr"
        inputMode="decimal"
        autoComplete="off"
        className="field font-mono text-lg"
        placeholder="e.g. 7/2 or 3.5"
        maxLength={8}
        value={text}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9./-]/g, "");
          setText(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(v), 500);
        }}
      />
      <p className="text-xs text-muted">Enter a number, a decimal, or a fraction like 7/2. Negative answers use −.</p>
    </div>
  );
}

function clock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
