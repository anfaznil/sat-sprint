import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { NotAllowedNotice } from "./not-allowed";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Sign in · SAT Sprint" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <p className="text-4xl">🏃‍♀️</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">SAT Sprint</h1>
        <p className="mt-1 text-muted">Small steps every day. Big jump on Dec 5.</p>
      </div>
      <Suspense>
        <NotAllowedNotice />
      </Suspense>
      <div className="card p-5">
        <LoginForm />
      </div>
    </main>
  );
}
