import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getErrors } from "@/lib/data/errors";
import { REASONS, reasonInfo, UNTAGGED, type ErrorItem, type Reason } from "@/lib/errors";
import { formatDay, today } from "@/lib/dates";
import { SECTION_LABEL } from "@/lib/skills";
import { BarList } from "@/components/bar-list";
import { Flash } from "@/components/flash";

export default function ErrorsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Error log</h1>
        <Link href="/errors/new" className="btn-primary px-3.5 py-2 text-sm">
          + Log a miss
        </Link>
      </div>
      <Suspense>
        <Flash param="saved" message="Logged. It'll come back tomorrow." />
      </Suspense>
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <ErrorLog />
      </Suspense>
    </div>
  );
}

async function ErrorLog() {
  await requireMember();
  const items = await getErrors();
  const now = today();

  if (items.length === 0) {
    return (
      <section className="card p-6 text-center">
        <p className="text-4xl">📕</p>
        <h2 className="mt-2 text-lg font-semibold">Your miss collection starts here</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
          Every question you miss on a practice test is a point you can win back. Log it, and it comes back for review in 1, 3, then 7 days.
        </p>
        <Link href="/errors/new" className="btn-primary mt-5">
          Log your first miss
        </Link>
      </section>
    );
  }

  const active = items.filter((i) => !i.cleared_at);
  const cleared = items.filter((i) => i.cleared_at);
  const due = active.filter((i) => i.next_review_on <= now);
  const nextUp = active.find((i) => i.next_review_on > now);

  const byReason: { label: string; icon: string; value: number }[] = (Object.keys(REASONS) as Reason[]).map((r) => ({
    label: REASONS[r].label,
    icon: REASONS[r].icon,
    value: items.filter((i) => i.reason === r).length,
  }));
  const untagged = items.filter((i) => !i.reason).length;
  if (untagged > 0) byReason.push({ label: UNTAGGED.label, icon: UNTAGGED.icon, value: untagged });
  const skillCounts = new Map<string, number>();
  for (const i of items) skillCounts.set(i.skills.name, (skillCounts.get(i.skills.name) ?? 0) + 1);
  const bySkill = [...skillCounts]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <>
      <section className="card flex items-center justify-between gap-4 p-5">
        {due.length > 0 ? (
          <>
            <div>
              <p className="text-2xl font-bold">{due.length} to review</p>
              <p className="text-sm text-muted">Win these points back today.</p>
            </div>
            <Link href="/errors/review" className="btn-primary shrink-0">
              Start
            </Link>
          </>
        ) : (
          <div>
            <p className="font-semibold">All caught up 🎉</p>
            <p className="text-sm text-muted">
              {nextUp ? `Next review: ${formatDay(nextUp.next_review_on, { weekday: "short", month: "short", day: "numeric" })}` : "Nothing scheduled."}
            </p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={items.length} label="logged" />
        <Stat value={active.length} label="in review" />
        <Stat value={cleared.length} label="mastered" />
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Why you miss</h2>
        <p className="mb-4 text-sm text-muted">{reasonInsight(byReason)}</p>
        <BarList rows={byReason} />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Where you miss</h2>
        <BarList rows={bySkill} />
        {skillCounts.size > bySkill.length && (
          <p className="mt-3 text-xs text-muted">Top {bySkill.length} of {skillCounts.size} skills.</p>
        )}
      </section>

      {active.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 font-semibold">In review</h2>
          <ul className="space-y-2">
            {active.map((i) => (
              <ErrorRow key={i.id} item={i} now={now} />
            ))}
          </ul>
        </section>
      )}

      {cleared.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold">Mastered ({cleared.length})</summary>
          <ul className="mt-3 space-y-2">
            {cleared.map((i) => (
              <ErrorRow key={i.id} item={i} now={now} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function reasonInsight(all: { label: string; value: number }[]) {
  const rows = all.filter((r) => r.label !== UNTAGGED.label);
  const top = [...rows].sort((a, b) => b.value - a.value)[0];
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!top || total < 5) return "Patterns show up after a few more misses.";
  const share = Math.round((top.value / total) * 100);
  return `${top.label} is ${share}% of your misses, so that's the habit to work on.`;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="card px-2 py-3">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ErrorRow({ item, now }: { item: ErrorItem; now: string }) {
  const isDue = !item.cleared_at && item.next_review_on <= now;
  return (
    <li>
      <Link href={`/errors/${item.id}`} className="card block p-4 transition active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold leading-snug">{item.skills.name}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              item.cleared_at ? "bg-good/15 text-good" : isDue ? "bg-accent text-white" : "bg-accent-soft text-accent"
            }`}
          >
            {item.cleared_at ? "Mastered" : isDue ? "Due" : formatDay(item.next_review_on)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{item.question_text || "📷 Screenshot"}</p>
        <p className="mt-2 text-xs text-muted">
          {reasonInfo(item.reason).icon} {reasonInfo(item.reason).label} · {item.difficulty} · {SECTION_LABEL[item.section]}
          {!item.cleared_at && ` · step ${item.stage} of 3`}
        </p>
      </Link>
    </li>
  );
}
