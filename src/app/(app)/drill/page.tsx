import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getDueErrors, signScreenshots } from "@/lib/data/errors";
import { countAnswered, getFocusSkills, getStreak, getTodaySession } from "@/lib/data/drill";
import { DrillRunner } from "./drill-runner";
import { getFocus } from "@/lib/data/settings";
import { FOCUS_LABEL } from "@/lib/skills";
import { TEST_DATE, today } from "@/lib/dates";
import { dayKind } from "@/lib/plan";

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
        <p className="text-5xl">🎯</p>
        <h1 className="mt-3 text-xl font-bold">{kind === "test" ? "It's test day!" : "The SAT is done!"}</h1>
        <p className="mt-1 text-muted">{kind === "test" ? "No drills today. Eat breakfast, breathe, and trust your prep." : "Hope it went great. You earned a break."}</p>
      </section>
    );
  }

  const sectionFocus = await getFocus();
  const [session, focus, due, streak] = await Promise.all([
    getTodaySession(member.id),
    getFocusSkills(),
    getDueErrors(sectionFocus),
    getStreak(member.id),
  ]);
  const [answered, urls] = await Promise.all([countAnswered(session.id), signScreenshots(due.map((d) => d.screenshot_path))]);

  return (
    <>
      {kind === "practice" && (
        <p className="mb-4 rounded-xl bg-accent-soft p-3 text-sm">
          📝 <strong>Saturday is practice test day.</strong> Take a full Bluebook test, then{" "}
          <Link href="/tests/new" className="font-medium text-accent underline">log your results</Link>. The drill below is optional today.
        </p>
      )}
      {sectionFocus !== "both" && (
        <p className="mb-3 text-xs text-muted">
          🎯 Focus: <strong className="text-ink">{FOCUS_LABEL[sectionFocus]}</strong> only.{" "}
          <Link href="/more#focus" className="underline">
            Change
          </Link>
        </p>
      )}
      <DrillRunner
        due={due}
        screenshotUrls={urls}
        answered={answered}
        planned={session.planned_new}
        completed={Boolean(session.completed_at)}
        startedAt={session.started_at}
        streak={streak}
        focus={focus.map((f) => f.skill.name)}
      />
      {focus.some((f) => f.accuracy === null) && (
        <p className="mt-4 text-center text-xs text-muted">
          Some focus skills were picked without test data.{" "}
          <Link href="/tests/new" className="underline">
            Add Bluebook results
          </Link>{" "}
          to target your real weak spots.
        </p>
      )}
    </>
  );
}
