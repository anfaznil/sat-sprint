import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BookCheck, Clock, Gauge } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getModule, getResultItems, type ResultItem } from "@/lib/data/modules";
import { FORMAT, targetSeconds, tierFromScore } from "@/lib/modules/blueprint";
import { formatDay } from "@/lib/dates";
import { Ico } from "@/components/ico";
import { SectionTag } from "@/components/section-tag";
import { TutorPanel } from "@/components/tutor-panel";

export default function ModuleResultsPage({ params }: PageProps<"/modules/[id]">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Results params={params} />
    </Suspense>
  );
}

async function Results({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const mod = await getModule(id);
  if (!mod) notFound();
  if (mod.status !== "submitted") redirect(mod.status === "in_progress" ? `/module/${id}` : "/drill");

  const items = await getResultItems(id);
  const score = mod.score ?? 0;
  const pct = Math.round((score / mod.total) * 100);
  const used = items.reduce((s, i) => s + i.seconds, 0);
  const target = targetSeconds(mod.section);
  const answered = items.filter((i) => i.chosen).length;
  const misses = items.filter((i) => !i.correct).length;
  const next = mod.module_no === 1 ? tierFromScore(score, mod.total) : null;

  // Accuracy by question type, in module order.
  const groups: { name: string; right: number; total: number }[] = [];
  for (const it of items) {
    let g = groups.find((x) => x.name === it.skillName);
    if (!g) groups.push((g = { name: it.skillName, right: 0, total: 0 }));
    g.total++;
    if (it.correct) g.right++;
  }

  return (
    <div className="space-y-5">
      <Link href="/drill" className="text-sm text-muted">
        ← Today
      </Link>

      <section className="card p-5 text-center">
        <div className="flex items-center justify-center gap-2">
          <SectionTag section={mod.section} />
          <span className="text-sm font-semibold text-muted">
            Module {mod.module_no}
            {mod.module_no === 2 && ` · ${mod.tier}`}
          </span>
        </div>
        <p className="mt-3 text-5xl font-bold tabular-nums">
          {score}
          <span className="text-2xl text-muted"> / {mod.total}</span>
        </p>
        <p className="text-sm text-muted">
          {pct}% correct{mod.submitted_at && ` · ${formatDay(mod.submitted_at.slice(0, 10), { weekday: "short", month: "short", day: "numeric" })}`}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Stat icon={Clock} value={`${mmss(used)}`} label={`of ${mmss(mod.time_limit_sec)}`} />
          <Stat icon={Gauge} value={`${answered ? Math.round(used / Math.max(1, answered)) : 0}s`} label={`per question (pace ${target}s)`} />
          <Stat icon={BookCheck} value={String(misses)} label="to error log" />
        </div>
        {next && (
          <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm">
            Next session: <strong>Module 2, {next === "harder" ? "the harder version" : "the easier version"}</strong>
            {next === "harder"
              ? ". Nice work! On the real SAT, that's the path to the top scores."
              : `. Get to ${Math.ceil(mod.total * 0.7)}+ on a Module 1 to unlock the harder Module 2.`}
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Pacing</h2>
        <p className="mb-4 text-sm text-muted">
          Seconds on each question. The dashed line is SAT pace ({target}s): {FORMAT[mod.section].seconds / 60} minutes ÷{" "}
          {mod.total} questions.
        </p>
        <PacingChart items={items} target={target} />
        <Slowest items={items} target={target} />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">By question type</h2>
        <ul className="space-y-2.5">
          {groups.map((g) => (
            <li key={g.name}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{g.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {g.right}/{g.total}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-line/70" role="presentation">
                <div className="h-full rounded bg-good" style={{ width: `${(g.right / g.total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 px-1 font-semibold">Review every question</h2>
        <ol className="space-y-2">
          {items.map((it) => (
            <ReviewRow key={it.position} item={it} target={target} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: typeof Clock; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-bg px-2 py-3">
      <p className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
        <Ico icon={icon} className="text-muted" />
        {value}
      </p>
      <p className="text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}

// One thin column per question; height = seconds spent; color = right / wrong / blank.
function PacingChart({ items, target }: { items: ResultItem[]; target: number }) {
  const max = Math.max(target * 2, ...items.map((i) => i.seconds));
  const H = 120;
  return (
    <figure>
      <div className="relative" style={{ height: H }} role="img" aria-label="Seconds spent on each question">
        <div
          className="absolute inset-x-0 border-t-2 border-dashed border-muted/60"
          style={{ bottom: (target / max) * H }}
          aria-hidden
        />
        <div className="flex h-full items-end gap-[2px]">
          {items.map((it) => (
            <div
              key={it.position}
              title={`Q${it.position}: ${it.seconds}s · ${it.correct ? "right" : it.chosen ? "wrong" : "no answer"}`}
              className={`flex-1 rounded-t-[3px] ${it.correct ? "bg-good" : it.chosen ? "bg-bad" : "bg-muted/40"}`}
              style={{ height: Math.max(3, (it.seconds / max) * H) }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted">
        <span>Q1</span>
        <span>Q{items.length}</span>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm bg-good" /> Right
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm bg-bad" /> Wrong
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm bg-muted/40" /> No answer
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 border-t-2 border-dashed border-muted/60" /> Pace
        </span>
      </figcaption>
    </figure>
  );
}

function Slowest({ items, target }: { items: ResultItem[]; target: number }) {
  const slow = [...items].filter((i) => i.seconds > target * 1.5).sort((a, b) => b.seconds - a.seconds).slice(0, 3);
  const blanks = items.filter((i) => !i.chosen).length;
  if (slow.length === 0 && blanks === 0) return <p className="mt-3 text-sm text-good">Steady pacing. Nothing took way over the clock.</p>;
  return (
    <div className="mt-3 space-y-1 text-sm">
      {slow.length > 0 && (
        <p>
          <strong>Time sinks:</strong>{" "}
          {slow.map((s) => `Q${s.position} (${s.seconds}s, ${s.skillName.toLowerCase()})`).join(", ")}. On test day, mark questions like these, guess, and come back.
        </p>
      )}
      {blanks > 0 && (
        <p className="text-bad">
          {blanks} left blank. There&apos;s no penalty for guessing, so always fill something in before time runs out.
        </p>
      )}
    </div>
  );
}

function ReviewRow({ item, target }: { item: ResultItem; target: number }) {
  const q = item.question;
  const status = item.correct ? "text-good" : item.chosen ? "text-bad" : "text-muted";
  return (
    <li>
      <details className="card overflow-hidden">
        <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold ${item.correct ? "bg-good/15 text-good" : item.chosen ? "bg-bad/15 text-bad" : "bg-line text-muted"}`}>
            {item.position}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{item.skillName}</span>
            <span className="block text-xs text-muted capitalize">
              {item.difficulty} · <span className={item.seconds > target * 1.5 ? "font-semibold text-warn" : ""}>{item.seconds}s</span>
            </span>
          </span>
          <span className={`shrink-0 text-sm font-semibold ${status}`}>{item.correct ? "✓" : item.chosen ? `✗ ${item.chosen}` : "—"}</span>
        </summary>
        {q && (
          <div className="space-y-3 border-t border-line px-4 py-4">
            {q.passage && <p className="whitespace-pre-wrap font-serif text-[16px] leading-[1.7]">{q.passage}</p>}
            <p className="whitespace-pre-wrap font-semibold">{q.stem}</p>
            {q.choices ? (
              <ol className="space-y-1.5 text-sm">
                {q.choices.map((c, i) => {
                  const letter = "ABCD"[i];
                  const right = letter === q.answer;
                  const picked = letter === item.chosen;
                  return (
                    <li
                      key={letter}
                      className={`flex gap-2 rounded-lg border px-3 py-2 ${right ? "border-good bg-good/10" : picked ? "border-bad bg-bad/10" : "border-line"}`}
                    >
                      <span className="font-bold">{letter}</span>
                      <span className="flex-1">{c}</span>
                      {right && <span className="text-good">✓</span>}
                      {picked && !right && <span className="text-bad">your answer</span>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm">
                Correct answer: <strong>{q.answer}</strong>
                {item.chosen && ` · you entered ${item.chosen}`}
              </p>
            )}
            <p className="text-[15px] leading-relaxed">{q.explanation}</p>
            {item.questionId && (
              <TutorPanel kind="question" id={item.questionId} label={item.correct ? "Explain it more" : undefined} />
            )}
          </div>
        )}
      </details>
    </li>
  );
}

function mmss(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}
