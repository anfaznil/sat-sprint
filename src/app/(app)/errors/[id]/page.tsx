import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signScreenshots } from "@/lib/data/errors";
import { ERROR_COLUMNS, type ErrorItem } from "@/lib/errors";
import { TagReason } from "./tag-reason";
import { formatDay, today } from "@/lib/dates";
import { SECTION_LABEL } from "@/lib/skills";
import { ConfirmButton } from "@/components/confirm-button";
import { TutorPanel } from "@/components/tutor-panel";
import { deleteError } from "../actions";
import { Ico } from "@/components/ico";
import { Lightbulb } from "lucide-react";

export default function ErrorDetailPage({ params }: PageProps<"/errors/[id]">) {
  return (
    <div className="space-y-4">
      <Link href="/errors" className="text-sm text-muted">
        ← Error log
      </Link>
      <Suspense fallback={<div className="card h-80 animate-pulse" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

type Review = { stage: number; correct: boolean; reviewed_at: string };

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = await createClient();
  const [{ data }, { data: reviews }] = await Promise.all([
    supabase.from("error_log").select(ERROR_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("error_reviews").select("stage, correct, reviewed_at").eq("error_id", id).order("reviewed_at"),
  ]);
  if (!data) notFound();
  const item = data as unknown as ErrorItem;
  const urls = await signScreenshots([item.screenshot_path]);
  const now = today();

  return (
    <>
      <section className="card space-y-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {SECTION_LABEL[item.section]} · {item.difficulty}
          </p>
          <h1 className="mt-1 text-lg font-bold leading-snug">{item.skills.name}</h1>
        </div>
        {item.question_text && <p className="whitespace-pre-wrap font-serif text-[17px] leading-[1.7]">{item.question_text}</p>}
        {item.screenshot_path && urls[item.screenshot_path] && (
          <a href={urls[item.screenshot_path]} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
            <img src={urls[item.screenshot_path]} alt="Question screenshot" className="w-full rounded-xl border border-line" />
          </a>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Answer label="You answered" value={item.her_answer} tone="bad" />
          <Answer label="Correct" value={item.correct_answer} tone="good" />
        </div>
        <TagReason id={item.id} reason={item.reason} />
        <p className="text-xs text-muted">Logged {formatDay(item.created_at.slice(0, 10))}</p>
        {item.notes && <p className="flex gap-2 rounded-xl bg-accent-soft p-3 text-sm"><Ico icon={Lightbulb} className="mt-0.5 text-accent" /> {item.notes}</p>}
        <TutorPanel kind="error" id={item.id} />
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Review schedule</h2>
        <Steps stage={item.stage} cleared={Boolean(item.cleared_at)} />
        <p className="mt-3 text-sm text-muted">
          {item.cleared_at
            ? "Mastered. You got it right on the 7-day review."
            : item.next_review_on <= now
              ? "Due now."
              : `Next review ${formatDay(item.next_review_on, { weekday: "long", month: "short", day: "numeric" })}.`}
        </p>
        {item.next_review_on <= now && !item.cleared_at && (
          <Link href="/errors/review" className="btn-primary mt-3 w-full">
            Review now
          </Link>
        )}
        {(reviews as Review[] | null)?.length ? (
          <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            {(reviews as Review[]).map((r) => (
              <li key={r.reviewed_at} className="flex justify-between">
                <span className="text-muted">{formatDay(r.reviewed_at.slice(0, 10))} · step {r.stage}</span>
                <span className={r.correct ? "text-good" : "text-bad"}>{r.correct ? "✓ Got it" : "✗ Missed"}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form action={deleteError} className="text-center">
        <input type="hidden" name="id" value={item.id} />
        <ConfirmButton message="Delete this miss from the log?" className="text-sm text-muted underline">
          Delete
        </ConfirmButton>
      </form>
    </>
  );
}

function Answer({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "good" ? "border-good/40 bg-good/10" : "border-bad/30 bg-bad/5"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 break-words text-lg font-semibold">{value}</p>
    </div>
  );
}

function Steps({ stage, cleared }: { stage: number; cleared: boolean }) {
  const steps = ["1 day", "3 days", "7 days"];
  return (
    <ol className="mt-3 flex gap-2">
      {steps.map((label, i) => {
        const done = cleared || i + 1 < stage;
        const current = !cleared && i + 1 === stage;
        return (
          <li
            key={label}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-medium ${
              done ? "bg-good/15 text-good" : current ? "bg-accent text-white" : "bg-line/60 text-muted"
            }`}
          >
            {done ? "✓ " : ""}
            {label}
          </li>
        );
      })}
    </ol>
  );
}
