import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getFocus } from "@/lib/data/settings";
import { FocusPicker } from "./focus-picker";

const LINKS = [
  { href: "/flashcards", icon: "🃏", title: "Grammar cards", detail: "Commas, semicolons, colons, transitions, agreement" },
  { href: "/desmos", icon: "📈", title: "Desmos tips", detail: "Graphing shortcuts for the Math section" },
  { href: "/tests", icon: "📝", title: "Practice tests", detail: "Your Bluebook results" },
  { href: "/tests/new", icon: "➕", title: "Add Bluebook results", detail: "After each Saturday test" },
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
        <h2 className="font-semibold">🎯 Test focus</h2>
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
              <span className="text-2xl" aria-hidden>
                {l.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.title}</span>
                <span className="block text-sm text-muted">{l.detail}</span>
              </span>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action="/auth/signout" method="post">
        <button className="btn-ghost w-full text-sm">Lock this device</button>
      </form>
      <p className="text-center text-xs text-muted">Locking asks for the passcode again. Your data stays saved.</p>
    </div>
  );
}
