"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookX, CalendarDays, House, Menu, Zap } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: House, match: [] as string[] },
  { href: "/drill", label: "Today", icon: Zap, match: [] },
  { href: "/errors", label: "Error log", icon: BookX, match: [] },
  { href: "/plan", label: "Plan", icon: CalendarDays, match: [] },
  { href: "/more", label: "More", icon: Menu, match: ["/tests", "/flashcards", "/desmos", "/modules"] },
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
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pb-2 pt-1.5 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-accent-soft" : ""}`}
                >
                  <tab.icon aria-hidden className="size-5" strokeWidth={active ? 2.4 : 2} />
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
