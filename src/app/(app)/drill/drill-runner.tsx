"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ErrorItem } from "@/lib/errors";
import { ReviewSession } from "../errors/review/review-session";
import { QuestionPlayer } from "./question-player";

type Props = {
  due: ErrorItem[];
  screenshotUrls: Record<string, string>;
  answered: number;
  planned: number;
  completed: boolean;
  startedAt: string;
  streak: number;
  focus: string[];
};

export function DrillRunner({ due, screenshotUrls, answered: initialAnswered, planned, completed, startedAt, streak, focus }: Props) {
  const [phase, setPhase] = useState<"reviews" | "questions" | "done">(
    completed ? "done" : due.length > 0 && initialAnswered === 0 ? "reviews" : "questions",
  );
  const [answered, setAnswered] = useState(initialAnswered);
  const toQuestions = useCallback(() => setPhase("questions"), []);
  const toDone = useCallback(() => setPhase("done"), []);

  const total = due.length + planned;
  const done = (phase === "reviews" ? 0 : due.length) + answered;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Today&apos;s drill</h1>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
            🔥 {streak + (phase === "done" && !completed ? 1 : 0)}-day streak
          </span>
        </div>
        {phase !== "done" && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded bg-line/70">
                <div className="h-full rounded bg-accent transition-all" style={{ width: `${(Math.min(done, total) / total) * 100}%` }} />
              </div>
              <Elapsed since={startedAt} />
            </div>
            <p className="text-sm text-muted">
              {phase === "reviews"
                ? `Step 1: ${due.length} review${due.length === 1 ? "" : "s"} from your error log`
                : planned === 0
                  ? "Light review day: no new questions. Rest up for Saturday."
                  : `Step 2: question ${Math.min(answered + 1, planned)} of ${planned} · ${focus.join(" · ")}`}
            </p>
          </>
        )}
      </header>

      {phase === "reviews" && <ReviewSession items={due} screenshotUrls={screenshotUrls} onFinish={toQuestions} />}
      {phase === "questions" && (
        <QuestionPlayer startSlot={answered} planned={planned} onProgress={setAnswered} onDone={toDone} />
      )}
      {phase === "done" && (
        <section className="card p-6 text-center">
          <p className="text-5xl">🔥</p>
          <h2 className="mt-3 text-xl font-bold">{planned === 0 ? "Light review done!" : "Drill done for today!"}</h2>
          <p className="mt-1 text-muted">
            {planned === 0
              ? "That's all for today. Flip through a few grammar cards if you want, then relax."
              : `${planned} new questions${due.length > 0 ? ` and ${due.length} reviews` : ""}. Come back tomorrow to keep the streak going.`}
          </p>
          <Link href="/" className="btn-primary mt-5">
            Back home
          </Link>
        </section>
      )}
    </div>
  );
}

// Minutes since today's drill started. The 30-minute target is a guide, not a timer.
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 30_000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, []);
  if (now === null) return null;
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  return <span className="shrink-0 text-sm tabular-nums text-muted">{minutes < 90 ? `${minutes} / 30 min` : "⏱"}</span>;
}
