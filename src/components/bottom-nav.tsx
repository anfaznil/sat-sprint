"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "🏠", match: [] as string[] },
  { href: "/drill", label: "Drill", icon: "⚡", match: [] },
  { href: "/errors", label: "Error log", icon: "📕", match: [] },
  { href: "/plan", label: "Plan", icon: "🗓️", match: [] },
  { href: "/more", label: "More", icon: "☰", match: ["/tests", "/flashcards", "/desmos"] },
];

export function BottomNav() {
  return <NavBar path={usePathname()} />;
}

// Rendered without a path as the Suspense fallback (dynamic routes resolve the path at request time).
export function NavBar({ path }: { path: string | null }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const active =
            path !== null &&
            (tab.href === "/" ? path === "/" : [tab.href, ...tab.match].some((prefix) => path.startsWith(prefix)));
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${active ? "text-accent" : "text-muted"}`}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
