import Link from "next/link";
import { ChartSpline, ChevronRight, ClipboardList, Layers, Lock, Plus, Target, Timer } from "lucide-react";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getFocus } from "@/lib/data/settings";
import { FocusPicker } from "./focus-picker";

const LINKS = [
  { href: "/flashcards", icon: Layers, tone: "text-rw bg-rw/12", title: "Grammar cards", detail: "Commas, semicolons, colons, transitions, agreement" },
  { href: "/desmos", icon: ChartSpline, tone: "text-math bg-math/12", title: "Desmos tips", detail: "Graphing shortcuts for the Math section" },
  { href: "/modules", icon: Timer, tone: "text-accent bg-accent-soft", title: "Timed modules", detail: "Scores and pacing from every module" },
  { href: "/tests", icon: ClipboardList, tone: "text-accent bg-accent-soft", title: "Practice tests", detail: "Your Bluebook results" },
  { href: "/tests/new", icon: Plus, tone: "text-accent bg-accent-soft", title: "Add Bluebook results", detail: "After each Saturday test" },
];

async function Focus() {
  await requireMember();
  return <FocusPicker current={await getFocus()} />;
}

export default function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">More</h1>
      <section id="focus" className="card scroll-mt-4 p-4">
        <h2 className="flex items-center gap-1.5 font-semibold"><Target aria-hidden className="size-4 text-accent" /> Test focus</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">
          Superscoring? Pick one section for this test date. Misses from the other section stay in your error log and
          come back when you switch.
        </p>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-line/50" />}>
          <Focus />
        </Suspense>
      </section>
      <ul className="card divide-y divide-line">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-accent-soft/50">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${l.tone}`}>
                <l.icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.title}</span>
                <span className="block text-sm text-muted">{l.detail}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <form action="/auth/signout" method="post">
        <button className="btn-ghost w-full gap-2 text-sm">
          <Lock aria-hidden className="size-4" /> Lock this device
        </button>
      </form>
      <p className="text-center text-xs text-muted">Locking asks for the passcode again. Your data stays saved.</p>
    </div>
  );
}
