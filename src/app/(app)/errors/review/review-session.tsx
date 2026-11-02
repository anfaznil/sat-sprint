"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { REASONS, type ErrorItem } from "@/lib/errors";
import { formatDay } from "@/lib/dates";
import { recordReview } from "../actions";
import { TutorPanel } from "@/components/tutor-panel";

type Result = { correct: boolean; cleared: boolean; nextReviewOn?: string | null };

export function ReviewSession({
  items: initial,
  screenshotUrls,
  onFinish,
}: {
  items: ErrorItem[];
  screenshotUrls: Record<string, string>;
  // Inside the daily drill: show a "continue" button instead of "back home".
  onFinish?: () => void;
}) {
  // Snapshot the queue: the server refreshes after each answer, but the session shouldn't shift.
  const [items] = useState(initial);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [tally, setTally] = useState({ right: 0, cleared: 0 });
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <section className="card p-6 text-center">
        <p className="text-4xl">🎉</p>
        <h1 className="mt-2 text-lg font-semibold">Nothing due right now</h1>
        <p className="mt-1 text-sm text-muted">Log misses from your practice tests and they&apos;ll show up here.</p>
      </section>
    );
  }

  if (index >= items.length) {
    return (
      <section className="card p-6 text-center">
        <p className="text-5xl">🏁</p>
        <h1 className="mt-3 text-xl font-bold">Review done!</h1>
        <p className="mt-1 text-muted">
          {tally.right} of {items.length} right
          {tally.cleared > 0 && ` · ${tally.cleared} mastered for good`}
        </p>
        <p className="mt-3 text-sm text-muted">
          {tally.right === items.length ? "Perfect round. Those points are yours." : "The misses come back tomorrow, and that repetition is how they stick."}
        </p>
        {onFinish ? (
          <button className="btn-primary mt-5" onClick={onFinish}>
            On to new questions →
          </button>
        ) : (
          <Link href="/" className="btn-primary mt-5">
            Back home
          </Link>
        )}
      </section>
    );
  }

  const item = items[index];
  const shot = item.screenshot_path ? screenshotUrls[item.screenshot_path] : undefined;

  function grade(correct: boolean) {
    setFailed(false);
    startTransition(async () => {
      try {
        const r = await recordReview(item.id, correct);
        setResult({ correct, cleared: r.cleared, nextReviewOn: r.nextReviewOn });
        setTally((t) => ({ right: t.right + (correct ? 1 : 0), cleared: t.cleared + (r.cleared ? 1 : 0) }));
      } catch {
        setFailed(true);
      }
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setRevealed(false);
    setResult(null);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded bg-line/70">
          <div className="h-full rounded bg-accent transition-all" style={{ width: `${(index / items.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted">
          {index + 1}/{items.length}
        </span>
      </div>

      <section className="card space-y-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Step {item.stage} of 3 · {item.difficulty}
          </p>
          <h1 className="mt-1 font-bold leading-snug">{item.skills.name}</h1>
        </div>
        {item.question_text && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{item.question_text}</p>}
        {shot && (
          // eslint-disable-next-line @next/next/no-img-element -- signed private URL
          <img src={shot} alt="Question screenshot" className="w-full rounded-xl border border-line" />
        )}
      </section>

      {!revealed ? (
        <div className="space-y-2">
          <p className="text-center text-sm text-muted">Work it out fresh on paper or in Desmos, then check.</p>
          <button className="btn-primary w-full" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        </div>
      ) : (
        <section className="card space-y-3 p-5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-good/40 bg-good/10 p-3">
              <p className="text-xs text-muted">Correct</p>
              <p className="break-words text-lg font-semibold">{item.correct_answer}</p>
            </div>
            <div className="rounded-xl border border-line p-3">
              <p className="text-xs text-muted">Last time you said</p>
              <p className="break-words text-lg font-semibold text-muted">{item.her_answer}</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            Missed because: {REASONS[item.reason].icon} {REASONS[item.reason].label}
          </p>
          {item.notes && <p className="rounded-xl bg-accent-soft p-3 text-sm">💡 {item.notes}</p>}
          <TutorPanel key={item.id} kind="error" id={item.id} />

          {result ? (
            <div className="space-y-3 pt-1">
              <p className={`text-center font-semibold ${result.correct ? "text-good" : "text-ink"}`}>
                {result.cleared
                  ? "Mastered! This one's off your list for good. 🎉"
                  : result.correct
                    ? `Nice! Back on ${formatDay(result.nextReviewOn!, { weekday: "short", month: "short", day: "numeric" })} to lock it in.`
                    : "No worries. It comes back tomorrow, and that's how it sticks."}
              </p>
              <button className="btn-primary w-full" onClick={next} autoFocus>
                {index + 1 < items.length ? "Next" : "Finish"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button className="btn-ghost" disabled={pending} onClick={() => grade(false)}>
                ✗ Missed it
              </button>
              <button className="btn-primary bg-good" disabled={pending} onClick={() => grade(true)}>
                ✓ Got it right
              </button>
            </div>
          )}
          {failed && <p className="text-center text-sm text-bad">Couldn&apos;t save that. Check your connection and tap again.</p>}
        </section>
      )}
    </div>
  );
}
