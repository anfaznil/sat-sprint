import Link from "next/link";

const LINKS = [
  { href: "/flashcards", icon: "🃏", title: "Grammar cards", detail: "Commas, semicolons, colons, transitions, agreement" },
  { href: "/desmos", icon: "📈", title: "Desmos tips", detail: "Graphing shortcuts for the Math section" },
  { href: "/tests", icon: "📝", title: "Practice tests", detail: "Your Bluebook results" },
  { href: "/tests/new", icon: "➕", title: "Add Bluebook results", detail: "After each Saturday test" },
];

export default function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">More</h1>
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
