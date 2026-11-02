import Link from "next/link";
import { Suspense } from "react";
import { BottomNav, NavBar } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-5">
        <Link href="/" className="text-lg font-bold tracking-tight">
          SAT Sprint
        </Link>
      </header>
      {children}
      <Suspense fallback={<NavBar path={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
