"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Clock, Flame, Leaf, ListChecks, PartyPopper, Play } from "lucide-react";
import type { ErrorItem } from "@/lib/errors";
import { FORMAT } from "@/lib/modules/blueprint";
import { IconTile } from "@/components/icon-tile";
import { ReviewSession } from "../errors/review/review-session";
import { startModule } from "../modules/actions";
import { finishLightDay } from "./actions";

type ModuleInfo = {
  id: string;
  section: "rw" | "math";
  moduleNo: 1 | 2;
  tier: "standard" | "harder" | "easier";
  total: number;
  minutes: number;
  status: "preparing" | "ready" | "in_progress" | "submitted";
  deadline: string | null;
};

type Props = {
  due: ErrorItem[];
  screenshotUrls: Record<string, string>;
  streak: number;
  light: boolean;
  dayDone: boolean;
  module: ModuleInfo | null;
  done: { id: string; score: number; total: number } | null;
};

export function DrillRunner({ due, screenshotUrls, streak, light, dayDone, module: mod, done }: Props) {
  const [phase, setPhase] = useState<"reviews" | "module" | "done">(
    done || (light && dayDone) ? "done" : due.length > 0 && mod?.status !== "in_progress" ? "reviews" : light ? "done" : "module",
  );
  const afterReviews = useCallback(() => {
    if (light) finishLightDay();
    setPhase(light ? "done" : "module");
  }, [light]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <span className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
          <Flame aria-hidden className="size-4 fill-orange-400 text-orange-500" />
          {streak}-day streak
        </span>
      </header>

      {phase !== "done" && (
        <ol className="flex gap-2 text-xs font-medium">
          <Step n={1} label={`Reviews (${due.length})`} active={phase === "reviews"} done={phase !== "reviews"} />
          {!light && <Step n={2} label="Timed module" active={phase === "module"} done={false} />}
        </ol>
      )}

      {phase === "reviews" && <ReviewSession items={due} screenshotUrls={screenshotUrls} onFinish={afterReviews} />}
      {phase === "module" && mod && <ModuleCard mod={mod} />}
      {phase === "done" && (
        <section className="card p-6 text-center">
          {light ? (
            <>
              <IconTile icon={Leaf} tone="good" size="lg" />
              <h2 className="mt-3 text-xl font-bold">Light review done!</h2>
              <p className="mt-1 text-muted">That&apos;s all for today. A few grammar cards if you like, then rest up for Saturday.</p>
              <Link href="/flashcards" className="btn-ghost mt-5">
                Grammar cards
              </Link>
            </>
          ) : done ? (
            <>
              <IconTile icon={PartyPopper} tone="good" size="lg" />
              <h2 className="mt-3 text-xl font-bold">Today&apos;s module is done</h2>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {done.score}
                <span className="text-xl text-muted"> / {done.total}</span>
              </p>
              <p className="mt-1 text-sm text-muted">Come back tomorrow for the next module.</p>
              <div className="mt-5 flex justify-center gap-2">
                <Link href={`/modules/${done.id}`} className="btn-primary">
                  See results
                </Link>
                <Link href="/flashcards" className="btn-ghost">
                  Grammar cards
                </Link>
              </div>
            </>
          ) : (
            <p className="text-muted">Nothing left for today.</p>
          )}
        </section>
      )}
    </div>
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${active ? "bg-accent text-white" : done ? "bg-good/15 text-good" : "bg-line/70 text-muted"}`}>
      <span className="font-bold">{done ? "✓" : n}</span> {label}
    </li>
  );
}

// The module's cover page: format, directions, preparation progress, then Start.
function ModuleCard({ mod }: { mod: ModuleInfo }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ filled: number; total: number; ready: boolean } | null>(
    mod.status === "preparing" ? null : { filled: mod.total, total: mod.total, ready: true },
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const section = FORMAT[mod.section].label;
  const title = `${mod.section === "rw" ? "Section 1" : "Section 2"}, Module ${mod.moduleNo}: ${section}`;

  async function recheck() {
    setProblem(null);
    const res = await fetch("/api/module/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moduleId: mod.id }),
    }).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (data) setProgress({ filled: data.filled, total: data.total, ready: data.ready });
    setProblem(data ? (data.error ?? null) : "Couldn't check the question bank. Try again.");
  }

  function start() {
    setProblem(null);
    startTransition(async () => {
      const r = await startModule(mod.id);
      if (r.error) setProblem(r.error);
      else router.push(`/module/${mod.id}`);
    });
  }

  const ready = progress?.ready ?? false;
  const inProgress = mod.status === "in_progress";

  return (
    <section className="card overflow-hidden">
      <div className={`px-5 py-5 text-white ${mod.section === "rw" ? "bg-gradient-to-br from-[#14a39d] to-[#0b6f6a]" : "bg-gradient-to-br from-[#3f7fe6] to-[#2453b0]"}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Timed module</p>
        <h2 className="mt-1 text-xl font-bold leading-snug">{title}</h2>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
          <span className="flex items-center gap-1">
            <ListChecks aria-hidden className="size-4" /> {mod.total} questions
          </span>
          <span className="flex items-center gap-1">
            <Clock aria-hidden className="size-4" /> {mod.minutes} minutes
          </span>
          {mod.moduleNo === 2 && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold capitalize">{mod.tier}</span>}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <ul className="space-y-1.5 text-sm text-muted">
          <li>• Same format and timing as a real SAT module. The clock keeps running if you leave.</li>
          <li>• Answer every question. There&apos;s no penalty for guessing.</li>
          <li>• Use Mark for Review on anything you want to revisit, and check your work before you submit.</li>
          {mod.section === "math" && <li>• Have Desmos open (desmos.com/calculator), just like the built-in one in Bluebook.</li>}
        </ul>

        {inProgress ? (
          <Link href={`/module/${mod.id}`} className="btn-primary w-full gap-2 py-3.5">
            <Play aria-hidden className="size-4 fill-white" /> Resume module
          </Link>
        ) : ready ? (
          <button className="btn-primary w-full gap-2 py-3.5" disabled={starting} onClick={start}>
            <Play aria-hidden className="size-4 fill-white" /> {starting ? "Starting…" : `Start the ${mod.minutes}-minute clock`}
          </button>
        ) : (
          <div className="rounded-xl bg-warn/10 p-4 text-sm">
            <p className="font-medium">
              {mod.section === "math" ? "Math modules aren't in the question bank yet." : "The question bank is running low."}
            </p>
            <p className="mt-1 text-muted">
              This module needs more questions before it can start{progress ? ` (${progress.filled}/${mod.total} ready)` : ""}. More can be added to the bank.
            </p>
            <button type="button" className="mt-2 font-medium underline" onClick={recheck}>
              Check again
            </button>
          </div>
        )}
        {problem && <p className="text-sm text-bad">{problem}</p>}
      </div>
    </section>
  );
}
