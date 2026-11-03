import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Zap } from "lucide-react";

export const metadata: Metadata = { title: "SAT Sprint" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7a6bf0] to-[#4a3bc4] text-white shadow-lg shadow-accent/30"><Zap aria-hidden className="size-7 fill-white" /></span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">SAT Sprint</h1>
        <p className="mt-1 text-muted">Small steps every day. Big jump on Dec 5.</p>
      </div>
      <div className="card p-5">
        <LoginForm />
      </div>
    </main>
  );
}
