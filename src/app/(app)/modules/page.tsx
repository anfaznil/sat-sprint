import Link from "next/link";
import { Suspense } from "react";
import { Timer } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getSubmittedModules } from "@/lib/data/modules";
import { formatDay } from "@/lib/dates";
import { IconTile } from "@/components/icon-tile";
import { SectionTag } from "@/components/section-tag";

export default function ModulesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Timed modules</h1>
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <History />
      </Suspense>
    </div>
  );
}

async function History() {
  await requireMember();
  const modules = await getSubmittedModules(60);
  if (modules.length === 0) {
    return (
      <section className="card p-6 text-center">
        <IconTile icon={Timer} />
        <p className="mt-3 font-semibold">No modules yet</p>
        <p className="mt-1 text-sm text-muted">Your first timed module is waiting on the Today tab.</p>
        <Link href="/drill" className="btn-primary mt-4">
          Go to Today
        </Link>
      </section>
    );
  }
  return (
    <ul className="space-y-2">
      {modules.map((m) => {
        const pct = Math.round(((m.score ?? 0) / m.total) * 100);
        return (
          <li key={m.id}>
            <Link href={`/modules/${m.id}`} className="card flex items-center gap-3 p-4 transition active:scale-[0.99]">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <SectionTag section={m.section} short /> Module {m.module_no}
                  {m.module_no === 2 && <span className="font-normal capitalize text-muted">· {m.tier}</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {m.submitted_at && formatDay(m.submitted_at.slice(0, 10), { weekday: "short", month: "short", day: "numeric" })}
                </p>
              </div>
              <span className="text-right">
                <span className="block text-lg font-bold tabular-nums">
                  {m.score}/{m.total}
                </span>
                <span className={`block text-xs ${pct >= 70 ? "text-good" : "text-muted"}`}>{pct}%</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
