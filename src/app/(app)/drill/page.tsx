import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList, Target } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getDueErrors, signScreenshots } from "@/lib/data/errors";
import { findTodaySession, getStreak } from "@/lib/data/drill";
import { getFocus } from "@/lib/data/settings";
import { getModule, getOrCreateModule, getTodayModule } from "@/lib/data/modules";
import { TEST_DATE, today } from "@/lib/dates";
import { dayKind } from "@/lib/plan";
import { FOCUS_LABEL } from "@/lib/skills";
import { Ico } from "@/components/ico";
import { IconTile } from "@/components/icon-tile";
import { DrillRunner } from "./drill-runner";

export default function DrillPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Drill />
    </Suspense>
  );
}

async function Drill() {
  const member = await requireMember();
  const kind = dayKind(today());
  if (kind === "test" || today() > TEST_DATE) {
    return (
      <section className="card p-6 text-center">
        <IconTile icon={Target} size="lg" />
        <h1 className="mt-3 text-xl font-bold">{kind === "test" ? "It's test day!" : "The SAT is done!"}</h1>
        <p className="mt-1 text-muted">{kind === "test" ? "No practice today. Eat breakfast, breathe, and trust your prep." : "Hope it went great. You earned a break."}</p>
      </section>
    );
  }

  const focus = await getFocus();
  const [due, streak, session] = await Promise.all([getDueErrors(focus), getStreak(member.id), findTodaySession(member.id)]);
  const urls = await signScreenshots(due.map((d) => d.screenshot_path));

  // Today's module: already finished, or the one to take (created on first visit).
  const light = kind === "light";
  const { done } = await getTodayModule(session?.id ?? null);
  const mod = light || done ? null : await getOrCreateModule();
  const doneModule = done ? await getModule(done.id) : null;

  return (
    <>
      {kind === "practice" && (
        <p className="mb-4 rounded-xl bg-accent-soft p-3 text-sm">
          <Ico icon={ClipboardList} className="mr-1 text-accent" /> <strong>Saturday is practice test day.</strong> Take a full
          Bluebook test, then{" "}
          <Link href="/tests/new" className="font-medium text-accent underline">
            log your results
          </Link>
          . Today&apos;s module is optional.
        </p>
      )}
      {focus !== "both" && (
        <p className="mb-3 text-xs text-muted">
          <Ico icon={Target} className="mr-1" /> Focus: <strong className="text-ink">{FOCUS_LABEL[focus]}</strong>.{" "}
          <Link href="/more#focus" className="underline">
            Change
          </Link>
        </p>
      )}
      <DrillRunner
        due={due}
        screenshotUrls={urls}
        streak={streak}
        light={light}
        dayDone={Boolean(session?.completed_at)}
        module={
          mod
            ? {
                id: mod.id,
                section: mod.section,
                moduleNo: mod.module_no,
                tier: mod.tier,
                total: mod.total,
                minutes: mod.time_limit_sec / 60,
                status: mod.status,
                deadline: mod.deadline_at,
              }
            : null
        }
        done={doneModule ? { id: doneModule.id, score: doneModule.score ?? 0, total: doneModule.total } : null}
      />
    </>
  );
}
