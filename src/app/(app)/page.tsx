import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getSkillMap, getSkillResults } from "@/lib/data/skills";
import { countDueErrors } from "@/lib/data/errors";
import { getStreak, getTodayProgress } from "@/lib/data/drill";
import { accuracyTone, FOCUS_LABEL, inFocus, rankSkills, SECTION_LABEL, type SkillStat } from "@/lib/skills";
import { getFocus } from "@/lib/data/settings";
import { getXp } from "@/lib/data/xp";
import { XpBar } from "@/components/xp-bar";
import { daysBetween, REGISTRATION_DEADLINE, TEST_DATE, today } from "@/lib/dates";
import { DAY_LABEL, dayKind } from "@/lib/plan";

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const member = await requireMember();
  const focus = await getFocus();
  const [{ domains, skills }, results, dueReviews, progress, streak, xp] = await Promise.all([
    getSkillMap(),
    getSkillResults(),
    countDueErrors(focus),
    getTodayProgress(member.id),
    getStreak(member.id),
    getXp(),
  ]);
  // Home follows the section focus; the other section's skills are hidden, not lost.
  const all = rankSkills(domains, skills, results);
  const ranked = all.ranked.filter((s) => inFocus(s.domain.section, focus));
  const untested = all.untested.filter((u) => inFocus(u.domain.section, focus));

  const now = today();
  const daysLeft = daysBetween(now, TEST_DATE);
  const daysToRegister = daysBetween(now, REGISTRATION_DEADLINE);
  const firstName = member.displayName.split(" ")[0];

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="bg-accent px-5 py-5 text-white">
          <p className="text-sm opacity-85">Hi {firstName} 👋</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">
            {daysLeft > 0 ? `${daysLeft} days` : daysLeft === 0 ? "Test day!" : "Done!"}
          </p>
          {daysLeft > 0 && <p className="text-sm opacity-85">until the SAT on Saturday, Dec 5</p>}
        </div>
        {daysLeft >= 0 && (
          <Link href="/plan" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span>
              Today: {DAY_LABEL[dayKind(now)].icon} <strong>{DAY_LABEL[dayKind(now)].title}</strong>
            </span>
            <span className="text-accent">Plan →</span>
          </Link>
        )}
        {daysToRegister >= 0 && (
          <p className="border-t border-line px-5 py-3 text-sm text-ink">
            📌 Registration closes <strong>Nov 20</strong>
            {daysToRegister === 0 ? " (today!)" : ` (${daysToRegister} day${daysToRegister === 1 ? "" : "s"} left)`}.
          </p>
        )}
      </section>

      {focus !== "both" && (
        <Link href="/more#focus" className="flex items-center justify-between rounded-xl bg-accent-soft px-4 py-2.5 text-sm">
          <span>
            🎯 Focusing on <strong>{FOCUS_LABEL[focus]}</strong> for this test
          </span>
          <span className="text-accent">Change</span>
        </Link>
      )}

      <XpBar xp={xp} />

      <DrillCard due={dueReviews} progress={progress} streak={streak} />

      {ranked.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <FocusCard skills={ranked.slice(0, 3)} />
          <section className="card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-semibold">{focus === "both" ? "All skills" : `${FOCUS_LABEL[focus]} skills`}, weakest first</h2>
              <Link href="/tests/new" className="text-sm font-medium text-accent">
                + Add test
              </Link>
            </div>
            <ol className="space-y-4">
              {ranked.map((stat) => (
                <SkillRow key={stat.skill.id} stat={stat} />
              ))}
            </ol>
          </section>
        </>
      )}

      {untested.length > 0 && ranked.length > 0 && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold">
            No data yet <span className="font-normal text-muted">({untested.length} skills)</span>
          </summary>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {untested.map(({ skill, domain }) => (
              <li key={skill.id}>
                {skill.name} <span className="opacity-70">· {SECTION_LABEL[domain.section]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function DrillCard({
  due,
  progress,
  streak,
}: {
  due: number;
  progress: Awaited<ReturnType<typeof getTodayProgress>>;
  streak: number;
}) {
  const status = progress.completed
    ? `Done for today ✓${progress.answered > 0 ? ` · ${progress.score}/${progress.answered} right` : ""}`
    : progress.started && progress.answered > 0
      ? `${progress.answered} of ${progress.planned} questions done · ${progress.score} right`
      : due > 0
        ? `${due} review${due === 1 ? "" : "s"} + new questions · ~30 min`
        : "New questions on your focus skills · ~30 min";
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">⚡ Today&apos;s drill</p>
          <p className="text-sm text-muted">{status}</p>
        </div>
        {!progress.completed && (
          <Link href="/drill" className="btn-primary shrink-0 px-4 py-2 text-sm">
            {progress.started && progress.answered > 0 ? "Continue" : "Start"}
          </Link>
        )}
      </div>
      <p className="mt-3 border-t border-line pt-3 text-sm">
        {streak > 0 ? (
          <>
            🔥 <strong>{streak}-day streak</strong>
            {!progress.completed && <span className="text-muted">. Keep it going today!</span>}
          </>
        ) : (
          <span className="text-muted">🔥 Finish today&apos;s drill to start a streak.</span>
        )}
      </p>
      {!progress.completed && due === 0 && (
        <Link href="/errors/new" className="mt-2 block text-sm font-medium text-accent">
          + Log a miss from a practice test
        </Link>
      )}
    </section>
  );
}

function FocusCard({ skills }: { skills: SkillStat[] }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Your focus right now</h2>
      <p className="mt-0.5 text-sm text-muted">The three skills with the most points waiting for you.</p>
      <ol className="mt-4 space-y-3">
        {skills.map((s, i) => (
          <li key={s.skill.id} className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{s.skill.name}</p>
              <p className="text-xs text-muted">
                {SECTION_LABEL[s.domain.section]} · {Math.round(s.accuracy * 100)}% correct
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SkillRow({ stat }: { stat: SkillStat }) {
  const pct = Math.round(stat.accuracy * 100);
  const tone = accuracyTone(stat.accuracy);
  const trend = stat.previous === null ? null : stat.latest - stat.previous;
  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{stat.skill.name}</p>
          <p className="text-xs text-muted">
            {stat.domain.name} · {stat.correct}/{stat.total}
            {trend !== null && trend !== 0 && (
              <span className={trend > 0 ? "text-good" : "text-bad"}>
                {" "}
                {trend > 0 ? "▲" : "▼"} since last test
              </span>
            )}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-semibold ${tone.text}`}>{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" role="presentation">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <section className="card p-6 text-center">
      <p className="text-4xl">🗺️</p>
      <h2 className="mt-2 text-lg font-semibold">Let&apos;s map your skills</h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
        Enter your results from a Bluebook practice test and we&apos;ll show exactly where your points are hiding.
      </p>
      <Link href="/tests/new" className="btn-primary mt-5">
        Add Bluebook results
      </Link>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <div className="card h-36 animate-pulse" />
      <div className="card h-52 animate-pulse" />
    </div>
  );
}
