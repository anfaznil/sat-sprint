import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getSkillMap, getSkillResults } from "@/lib/data/skills";
import { countDueErrors } from "@/lib/data/errors";
import { findTodaySession, getStreak } from "@/lib/data/drill";
import { getTodayModule } from "@/lib/data/modules";
import { FORMAT } from "@/lib/modules/blueprint";
import { accuracyTone, FOCUS_LABEL, inFocus, rankSkills, type Focus, type SkillStat } from "@/lib/skills";
import { getFocus } from "@/lib/data/settings";
import { getXp } from "@/lib/data/xp";
import { daysBetween, REGISTRATION_DEADLINE, TEST_DATE, today } from "@/lib/dates";
import { dayKind, type DayKind } from "@/lib/plan";
import { levelFor } from "@/lib/xp";
import { ArrowRight, Flame, Map, Pin, Plus, Star, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Ico } from "@/components/ico";
import { SectionTag } from "@/components/section-tag";

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
  const session = await findTodaySession(member.id);
  const [{ domains, skills }, results, dueReviews, progress, streak, xp] = await Promise.all([
    getSkillMap(),
    getSkillResults(),
    countDueErrors(focus),
    getTodayProgress(session),
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
      <Hero
        firstName={firstName}
        daysLeft={daysLeft}
        kind={dayKind(now)}
        focus={focus}
        due={dueReviews}
        progress={progress}
        streak={streak}
        xp={xp}
      />

      {daysToRegister >= 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-sm">
          <Ico icon={Pin} className="text-warn" />
          <span>
            Register by <strong>Nov 20</strong>
            {daysToRegister === 0 ? " (today!)" : ` · ${daysToRegister} day${daysToRegister === 1 ? "" : "s"} left`}
          </span>
        </p>
      )}

      {ranked.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <FocusCard skills={ranked.slice(0, 3)} />
          <section className="card p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">{focus === "both" ? "All skills" : `${FOCUS_LABEL[focus]} skills`}, weakest first</h2>
              <Link href="/tests/new" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-accent">
                <Ico icon={Plus} /> Add test
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
              <li key={skill.id} className="flex items-center justify-between gap-2">
                <span>{skill.name}</span>
                <SectionTag section={domain.section} short />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type Cta = { href: string; title: string; detail: string; done?: boolean };

type Progress = {
  completed: boolean;
  done: { score: number; total: number } | null;
  open: { id: string; status: string } | null;
  next: { label: string; minutes: number };
};

async function getTodayProgress(session: Awaited<ReturnType<typeof findTodaySession>>): Promise<Progress> {
  const { open, done, next } = await getTodayModule(session?.id ?? null);
  const tier = next.moduleNo === 2 ? ` (${next.tier})` : "";
  return {
    completed: Boolean(session?.completed_at),
    done: done ? { score: done.score ?? 0, total: done.total } : null,
    open: open ? { id: open.id, status: open.status } : null,
    next: { label: `${next.section === "rw" ? "R&W" : "Math"} Module ${next.moduleNo}${tier}`, minutes: FORMAT[next.section].seconds / 60 },
  };
}

// What to do today, as one button: the drill, the Saturday practice test, or rest.
function todaysCta(kind: DayKind, due: number, progress: Progress): Cta {
  if (kind === "test") return { href: "/plan#test-day", title: "Good luck today!", detail: "Test-day checklist" };
  if (progress.open?.status === "in_progress") {
    return { href: `/module/${progress.open.id}`, title: "Resume your module", detail: "The clock is running" };
  }
  if (progress.completed) {
    return {
      href: "/flashcards",
      title: kind === "light" ? "Light review is done" : "Today's module is done",
      detail: `${progress.done ? `${progress.done.score}/${progress.done.total} right · ` : ""}Bonus: grammar cards`,
      done: true,
    };
  }
  if (kind === "practice") return { href: "/tests/new", title: "Practice test day", detail: "Full Bluebook test, then log results" };
  if (kind === "light") return { href: "/drill", title: "Light review", detail: due > 0 ? `${due} quick review${due === 1 ? "" : "s"}` : "Grammar cards and rest" };
  return {
    href: "/drill",
    title: "Start today's module",
    detail: `${due > 0 ? `${due} review${due === 1 ? "" : "s"} + ` : ""}${progress.next.label} · ${progress.next.minutes} min`,
  };
}

function Hero({
  firstName,
  daysLeft,
  kind,
  focus,
  due,
  progress,
  streak,
  xp,
}: {
  firstName: string;
  daysLeft: number;
  kind: DayKind;
  focus: Focus;
  due: number;
  progress: Progress;
  streak: number;
  xp: number;
}) {
  const cta = todaysCta(kind, due, progress);
  const { level, into, span } = levelFor(xp);
  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#7a6bf0] to-[#4a3bc4] text-white shadow-lg shadow-accent/20">
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-white/85">Hi {firstName}!</p>
          {focus !== "both" && (
            <Link href="/more#focus" className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
              <Ico icon={Target} /> {FOCUS_LABEL[focus]} focus
            </Link>
          )}
        </div>
        <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums">
          {daysLeft > 0 ? (
            <>
              {daysLeft}
              <span className="ml-1.5 text-xl font-semibold text-white/85">days</span>
            </>
          ) : daysLeft === 0 ? (
            "Test day!"
          ) : (
            "Done!"
          )}
        </p>
        {daysLeft > 0 && <p className="text-sm text-white/80">until the SAT · Saturday, Dec 5</p>}

        <Link
          href={cta.href}
          className={`mt-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 shadow-md transition active:scale-[0.98] ${
            cta.done ? "bg-white/15 text-white" : "bg-white text-[#1d1b2c]"
          }`}
        >
          <span className="min-w-0">
            <span className={`block text-base font-semibold ${cta.done ? "" : "text-[#4a3bc4]"}`}>{cta.title}</span>
            <span className={`block truncate text-xs ${cta.done ? "text-white/80" : "text-[#6b6880]"}`}>{cta.detail}</span>
          </span>
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${cta.done ? "bg-white/20" : "bg-[#5b4bdb] text-white"}`}>
            <ArrowRight aria-hidden className="size-5" />
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-2 divide-x divide-white/15 border-t border-white/15 text-sm">
        <div className="flex items-center gap-2 px-4 py-3">
          <Flame aria-hidden className={`size-5 ${streak > 0 ? "fill-orange-300 text-orange-300" : "text-white/60"}`} />
          <span>
            <span className="block font-semibold leading-tight">{streak}-day streak</span>
            <span className="block text-xs text-white/75">{streak > 0 ? "Keep it going" : "Start one today"}</span>
          </span>
        </div>
        <div className="px-4 py-3" aria-label={`Level ${level}, ${into} of ${span} XP`}>
          <span className="flex items-center gap-1.5 font-semibold leading-tight">
            <Star aria-hidden className="size-4 fill-amber-300 text-amber-300" /> Level {level}
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full rounded-full bg-amber-300" style={{ width: `${Math.max(4, (into / span) * 100)}%` }} />
          </span>
          <span className="mt-1 block text-[11px] text-white/75">
            {into} / {span} XP
          </span>
        </div>
      </div>
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
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <SectionTag section={s.domain.section} short /> {Math.round(s.accuracy * 100)}% correct
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
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
            <SectionTag section={stat.domain.section} short />
            {stat.domain.name} · {stat.correct}/{stat.total}
            {trend !== null && trend !== 0 && (
              <span className={`flex items-center gap-0.5 ${trend > 0 ? "text-good" : "text-bad"}`}>
                <Ico icon={trend > 0 ? TrendingUp : TrendingDown} /> since last test
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
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Map aria-hidden className="size-7" />
      </span>
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
      <div className="h-64 animate-pulse rounded-3xl bg-accent/30" />
      <div className="card h-52 animate-pulse" />
    </div>
  );
}
