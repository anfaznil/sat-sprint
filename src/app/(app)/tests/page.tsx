import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDay } from "@/lib/dates";
import { deleteTest } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";

export default function TestsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Practice tests</h1>
        <Link href="/tests/new" className="btn-primary px-3.5 py-2 text-sm">
          + Add
        </Link>
      </div>
      <Suspense fallback={<div className="card h-40 animate-pulse" />}>
        <TestList />
      </Suspense>
    </div>
  );
}

type TestRow = {
  id: string;
  label: string;
  taken_on: string;
  rw_score: number | null;
  math_score: number | null;
  skill_results: { correct: number; total: number }[];
};

async function TestList() {
  await requireMember();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_tests")
    .select("id, label, taken_on, rw_score, math_score, skill_results(correct, total)")
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const tests = data as TestRow[];

  if (tests.length === 0) {
    return (
      <p className="card p-6 text-center text-sm text-muted">
        No tests yet. Your Saturday Bluebook tests go here.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {tests.map((t) => {
        const correct = t.skill_results.reduce((s, r) => s + r.correct, 0);
        const total = t.skill_results.reduce((s, r) => s + r.total, 0);
        const composite = t.rw_score !== null && t.math_score !== null ? t.rw_score + t.math_score : null;
        return (
          <li key={t.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{t.label}</p>
                <p className="text-sm text-muted">
                  {formatDay(t.taken_on, { weekday: "short", month: "short", day: "numeric" })} · {correct}/{total}{" "}
                  correct across {t.skill_results.length} skills
                </p>
              </div>
              {composite !== null && <span className="text-xl font-bold text-accent">{composite}</span>}
            </div>
            {(t.rw_score !== null || t.math_score !== null) && (
              <p className="mt-2 text-sm">
                {t.rw_score !== null && <span className="mr-4">R&amp;W {t.rw_score}</span>}
                {t.math_score !== null && <span>Math {t.math_score}</span>}
              </p>
            )}
            <form action={deleteTest} className="mt-3">
              <input type="hidden" name="id" value={t.id} />
              <ConfirmButton message={`Delete "${t.label}" and its results?`} className="text-sm text-muted underline">
                Delete
              </ConfirmButton>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
