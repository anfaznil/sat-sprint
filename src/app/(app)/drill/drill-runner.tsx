"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ErrorItem } from "@/lib/errors";
import { ReviewSession } from "../errors/review/review-session";
import { QuestionPlayer } from "./question-player";
import { XpBar } from "@/components/xp-bar";
import { drillXp, levelFor } from "@/lib/xp";
import { celebrate } from "@/lib/celebrate";
import { Ico } from "@/components/ico";
import { IconTile } from "@/components/icon-tile";
import { BookCheck, Flame, Trophy } from "lucide-react";

type Props = {
  due: ErrorItem[];
  screenshotUrls: Record<string, string>;
  answered: number;
  score: number;
  // Total XP when the page loaded; this sitting's XP is added on the done screen.
  xp: number;
  planned: number;
  completed: boolean;
  startedAt: string;
  streak: number;
  focus: string[];
};

export function DrillRunner({
  due,
  screenshotUrls,
  answered: initialAnswered,
  score: initialScore,
  xp,
  planned,
  completed,
  startedAt,
  streak,
  focus,
}: Props) {
  const [phase, setPhase] = useState<"reviews" | "questions" | "done">(
    completed ? "done" : due.length > 0 && initialAnswered === 0 ? "reviews" : "questions",
  );
  const [answered, setAnswered] = useState(initialAnswered);
  const [score, setScore] = useState(initialScore);
  const [reviewTally, setReviewTally] = useState<{ right: number; total: number } | null>(null);
  const toQuestions = useCallback((tally: { right: number; total: number }) => {
    setReviewTally(tally);
    setPhase("questions");
  }, []);
  const onProgress = useCallback((a: number, s: number) => {
    setAnswered(a);
    setScore(s);
  }, []);
  const toDone = useCallback(() => setPhase("done"), []);

  // Confetti when she finishes the drill in this sitting (not when revisiting a finished day).
  useEffect(() => {
    if (phase === "done" && !completed) celebrate();
  }, [phase, completed]);

  const total = due.length + planned;
  const done = (phase === "reviews" ? 0 : due.length) + answered;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Today&apos;s drill</h1>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
            <Ico icon={Flame} className="mr-1 fill-orange-400 text-orange-500" />
            {streak + (phase === "done" && !completed ? 1 : 0)}-day streak
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
                  : `Step 2: question ${Math.min(answered + 1, planned)} of ${planned}${answered > 0 ? ` · ✓ ${score} right` : ""} · ${focus.join(" · ")}`}
            </p>
          </>
        )}
      </header>

      {phase === "reviews" && <ReviewSession items={due} screenshotUrls={screenshotUrls} onFinish={toQuestions} />}
      {phase === "questions" && (
        <QuestionPlayer startSlot={answered} planned={planned} onProgress={onProgress} onDone={toDone} />
      )}
      {phase === "done" && (
        <section className="card p-6 text-center">
          <IconTile icon={Flame} tone="fire" size="lg" />
          <h2 className="mt-3 text-xl font-bold">{planned === 0 ? "Light review done!" : "Drill done for today!"}</h2>
          {answered > 0 && <Score right={score} total={answered} />}
          <EarnedXp
            xp={xp}
            earned={drillXp(score - initialScore, answered - initialAnswered, reviewTally, !completed)}
          />
          {reviewTally && reviewTally.total > 0 && (
            <p className="mt-2 text-sm text-muted">
              Reviews: {reviewTally.right} of {reviewTally.total} right
            </p>
          )}
          {answered > score && (
            <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm">
              <Ico icon={BookCheck} className="mr-1.5 text-accent" />
              The {answered - score} you missed {answered - score === 1 ? "is" : "are"} saved in your error log and come back
              tomorrow.{" "}
              <Link href="/errors" className="font-medium text-accent underline">
                See them
              </Link>
            </p>
          )}
          <p className="mt-3 text-muted">
            {planned === 0
              ? "That's all for today. Flip through a few grammar cards if you want, then relax."
              : "Come back tomorrow to keep the streak going."}
          </p>
          <Link href="/" className="btn-primary mt-5">
            Back home
          </Link>
        </section>
      )}
    </div>
  );
}

// The bar starts at her XP from before this sitting and fills up to the new total.
function EarnedXp({ xp, earned }: { xp: number; earned: number }) {
  const [shown, setShown] = useState(xp);
  useEffect(() => {
    if (earned <= 0) return;
    const t = setTimeout(() => setShown(xp + earned), 450);
    return () => clearTimeout(t);
  }, [xp, earned]);
  const newLevel = levelFor(xp + earned).level;
  const leveledUp = newLevel > levelFor(xp).level && shown === xp + earned;
  useEffect(() => {
    if (leveledUp) celebrate(true);
  }, [leveledUp]);

  return (
    <div className="mx-auto mt-4 max-w-64 rounded-xl bg-bg p-3 text-left">
      {earned > 0 && <p className="mb-2 animate-rise text-center text-lg font-bold text-accent">+{earned} XP</p>}
      {leveledUp && (
        <p className="mb-2 flex animate-pop items-center justify-center gap-1.5 rounded-lg bg-amber-400/20 py-1.5 text-sm font-bold text-amber-600 dark:text-amber-300">
          <Trophy aria-hidden className="size-4" /> Level up! You&apos;re level {newLevel}
        </p>
      )}
      <XpBar xp={shown} compact />
    </div>
  );
}

function Score({ right, total }: { right: number; total: number }) {
  const pct = Math.round((right / total) * 100);
  return (
    <div className="mx-auto mt-4 max-w-56">
      <p className="text-4xl font-bold tabular-nums">
        {right}
        <span className="text-2xl text-muted"> / {total}</span>
      </p>
      <p className="text-sm text-muted">new questions right · {pct}%</p>
      <div className="mt-2 h-2.5 overflow-hidden rounded bg-line/70" role="presentation">
        <div className="h-full rounded bg-good" style={{ width: `${pct}%` }} />
      </div>
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
  return <span className="shrink-0 text-sm tabular-nums text-muted">{minutes < 90 ? `${minutes} / 30 min` : ""}</span>;
}
