import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getActiveDays } from "@/lib/data/drill";
import { daysBetween, formatDay, REGISTRATION_DEADLINE, TEST_DATE, today } from "@/lib/dates";
import { buildPlan, DAY_LABEL, type PlanDay } from "@/lib/plan";
import { Ico } from "@/components/ico";
import { Backpack, CircleCheck, ClipboardList, Leaf, Pin, Zap } from "lucide-react";

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Plan />
    </Suspense>
  );
}

const ACTION: Record<PlanDay["kind"], { href: string; label: string }> = {
  drill: { href: "/drill", label: "Start drill" },
  practice: { href: "/tests/new", label: "Log results" },
  light: { href: "/drill", label: "Light review" },
  test: { href: "/plan#test-day", label: "Checklist" },
};

async function Plan() {
  const member = await requireMember();
  const now = today();
  const { drillDays, testDays } = await getActiveDays(member.id);
  const drilled = new Set(drillDays);
  const tested = new Set(testDays);
  const weeks = buildPlan(now);
  const daysLeft = daysBetween(now, TEST_DATE);
  const toRegister = daysBetween(now, REGISTRATION_DEADLINE);

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="bg-accent px-5 py-5 text-white">
          <p className="text-sm opacity-85">Countdown</p>
          <p className="text-4xl font-bold tracking-tight">{daysLeft > 0 ? `${daysLeft} days` : daysLeft === 0 ? "Today!" : "Done!"}</p>
          <p className="text-sm opacity-85">SAT · Saturday, December 5</p>
        </div>
        <p className="border-t border-line px-5 py-3 text-sm">
          {toRegister > 0 ? (
            <>
              <Ico icon={Pin} className="mr-1 text-warn" /> <strong>Register by Nov 20</strong> ({toRegister} day{toRegister === 1 ? "" : "s"} left) on the{" "}
              <a className="text-accent underline" href="https://satsuite.collegeboard.org/sat/registration" target="_blank" rel="noreferrer">
                College Board site
              </a>
              .
            </>
          ) : toRegister === 0 ? (
            <>
              <Ico icon={Pin} className="mr-1 text-warn" /> <strong>Registration closes today!</strong>
            </>
          ) : (
            <><Ico icon={Pin} className="mr-1 text-muted" /> Registration closed Nov 20. Double-check your admission ticket in your College Board account.</>
          )}
        </p>
      </section>

      <section className="card p-5 text-sm">
        <h2 className="mb-2 font-semibold">How the plan works</h2>
        <ul className="space-y-1 text-muted">
          <li><Ico icon={ClipboardList} className="mr-1.5 text-accent" /><strong className="text-ink">Saturdays:</strong> a full Bluebook practice test, like the real thing.</li>
          <li><Ico icon={Zap} className="mr-1.5 text-accent" /><strong className="text-ink">Other days:</strong> the 30-minute daily drill.</li>
          <li><Ico icon={Leaf} className="mr-1.5 text-good" /><strong className="text-ink">Dec 3–4:</strong> light review only. Rest your brain.</li>
        </ul>
      </section>

      {weeks.map((week) => (
        <section key={week.weekOf}>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Week of {formatDay(week.weekOf)}</h2>
          <ol className="card divide-y divide-line">
            {week.days.map((d) => {
              const label = DAY_LABEL[d.kind];
              const isToday = d.date === now;
              const past = d.date < now;
              const done = d.kind === "practice" ? tested.has(d.date) : drilled.has(d.date);
              return (
                <li key={d.date} id={d.kind === "test" ? "test-day" : undefined} className={`flex items-center gap-3 px-4 py-3 ${isToday ? "bg-accent-soft/60" : ""} ${past && !isToday ? "opacity-60" : ""}`}>
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-xs uppercase text-muted">{formatDay(d.date, { weekday: "short" })}</p>
                    <p className="text-lg font-bold leading-tight">{formatDay(d.date, { day: "numeric" })}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      <Ico icon={label.icon} className="mr-1 text-accent" /> {label.title}
                      {isToday && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-white">Today</span>}
                    </p>
                    <p className="text-xs text-muted">{d.note ?? label.detail}</p>
                  </div>
                  {done ? (
                    <CircleCheck aria-label="Done" className="size-5 shrink-0 text-good" />
                  ) : isToday ? (
                    <Link href={ACTION[d.kind].href} className="btn-primary shrink-0 px-3 py-1.5 text-xs">
                      {ACTION[d.kind].label}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <section className="card p-5 text-sm">
        <h2 className="mb-2 flex items-center gap-1.5 font-semibold"><Ico icon={Backpack} className="text-accent" /> Test-day checklist</h2>
        <ul className="list-inside list-disc space-y-1 text-muted">
          <li>Device charged, with Bluebook updated and exam setup done the day before</li>
          <li>Admission ticket (from Bluebook)</li>
          <li>Acceptable photo ID</li>
          <li>Pencils/pen for scratch work, and a calculator if you like (Desmos is built in)</li>
          <li>Snacks and water for the break</li>
          <li>Sleep. It beats one more practice set.</li>
        </ul>
      </section>
    </div>
  );
}
