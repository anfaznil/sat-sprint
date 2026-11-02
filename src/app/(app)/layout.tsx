import Link from "next/link";
import { Suspense } from "react";
import { BottomNav, NavBar } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-5 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight">
          SAT Sprint
        </Link>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-muted">Sign out</button>
        </form>
      </header>
      {children}
      <Suspense fallback={<NavBar path={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
