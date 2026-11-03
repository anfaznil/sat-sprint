"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { REASONS, type Reason } from "@/lib/errors";
import type { NextResult, PlayerQuestion } from "@/lib/drill/next";
import { answerQuestion, tagDrillMiss, type AnswerResult } from "./actions";
import { TutorPanel } from "@/components/tutor-panel";

const LETTERS = ["A", "B", "C", "D"];

async function fetchQuestion(slot: number, exclude: string[]): Promise<NextResult> {
  try {
    const res = await fetch("/api/drill/next", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, exclude }),
    });
    return (await res.json()) as NextResult;
  } catch {
    return { status: "error", message: "No connection. Check your internet and try again." };
  }
}

export function QuestionPlayer({
  startSlot,
  planned,
  onProgress,
  onDone,
}: {
  startSlot: number;
  planned: number;
  onProgress: (answered: number, score: number) => void;
  onDone: () => void;
}) {
  const [slot, setSlot] = useState(startSlot);
  const [question, setQuestion] = useState<PlayerQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [missTag, setMissTag] = useState<Reason | null>(null);
  const [pending, startTransition] = useTransition();
  const shownAt = useRef(0);
  const prefetch = useRef<{ slot: number; promise: Promise<NextResult> } | null>(null);

  const show = useCallback(
    (r: NextResult) => {
      if (r.status === "done") return onDone();
      if (r.status === "error") return setError(r.message);
      setQuestion(r.question);
      shownAt.current = Date.now();
      // Start writing the next one while she works on this one.
      if (slot + 1 < planned) prefetch.current = { slot: slot + 1, promise: fetchQuestion(slot + 1, [r.question.id]) };
    },
    [slot, planned, onDone],
  );

  const [attempt, setAttempt] = useState(0);

  // Fetch (or take the prefetched) question for each new slot, and on retry.
  useEffect(() => {
    let cancelled = false;
    const ready = prefetch.current?.slot === slot ? prefetch.current.promise : fetchQuestion(slot, []);
    prefetch.current = null;
    ready.then((r) => {
      if (!cancelled) show(r);
    });
    return () => {
      cancelled = true;
    };
  }, [slot, show, attempt]);

  function retry() {
    setError(null);
    setAttempt((a) => a + 1);
  }

  function submit(answer: string) {
    if (!question || result || !answer.trim()) return;
    setChosen(answer);
    startTransition(async () => {
      try {
        const r = await answerQuestion(question.id, answer, (Date.now() - shownAt.current) / 1000);
        setResult(r);
        onProgress(r.answered, r.score);
      } catch {
        setError("Couldn't save your answer. Check your connection and tap again.");
      }
    });
  }

  function tagMiss(reason: Reason) {
    if (!question) return;
    const previous = missTag;
    setMissTag(reason);
    startTransition(async () => {
      try {
        await tagDrillMiss(question.id, chosen, reason);
      } catch {
        setMissTag(previous);
        setError("Couldn't save that. Try again.");
      }
    });
  }

  function next() {
    if (result?.completed && slot + 1 >= planned) return onDone();
    setResult(null);
    setChosen("");
    setMissTag(null);
    setQuestion(null);
    setError(null);
    setSlot((s) => s + 1);
    window.scrollTo({ top: 0 });
  }

  if (error && !question) {
    return (
      <section className="card space-y-3 p-6 text-center">
        <p className="text-3xl">😕</p>
        <p className="text-sm">{error}</p>
        <button className="btn-primary" onClick={retry}>
          Try again
        </button>
      </section>
    );
  }

  if (!question) {
    return (
      <section className="card space-y-3 p-6 text-center" aria-busy>
        <div className="mx-auto size-8 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
        <p className="font-medium">Getting your next question…</p>
        <p className="text-sm text-muted">Brand-new ones take a few seconds to write.</p>
      </section>
    );
  }

  const multipleChoice = question.choices !== null;
  const answerIndex = result ? LETTERS.indexOf(result.answer) : -1;

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {question.skillName} · {question.difficulty}
        </p>
        {question.passage && (
          <p className="whitespace-pre-wrap rounded-xl bg-bg p-4 text-[15px] leading-relaxed">{question.passage}</p>
        )}
        <p className="whitespace-pre-wrap font-medium leading-relaxed">{question.stem}</p>
      </section>

      {multipleChoice ? (
        <ol className="space-y-2">
          {question.choices!.map((choice, i) => {
            const letter = LETTERS[i];
            const isAnswer = result && i === answerIndex;
            const isWrongPick = result && !result.correct && chosen === letter;
            return (
              <li key={letter}>
                <button
                  disabled={Boolean(result) || pending}
                  onClick={() => submit(letter)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition active:scale-[0.99] ${
                    isAnswer
                      ? "border-good bg-good/10"
                      : isWrongPick
                        ? "border-bad bg-bad/10"
                        : pending && chosen === letter
                          ? "border-accent bg-accent-soft"
                          : "border-line bg-card"
                  }`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isAnswer ? "bg-good text-white" : isWrongPick ? "bg-bad text-white" : "bg-accent-soft text-accent"
                    }`}
                  >
                    {isAnswer ? "✓" : isWrongPick ? "✗" : letter}
                  </span>
                  <span className="whitespace-pre-wrap pt-0.5 text-[15px]">{choice}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <form
          className="card flex gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(String(new FormData(e.currentTarget).get("answer") ?? ""));
          }}
        >
          <input
            name="answer"
            inputMode="decimal"
            autoComplete="off"
            disabled={Boolean(result)}
            placeholder="Your answer (e.g. 7/2 or 3.5)"
            className="field"
          />
          <button className="btn-primary shrink-0" disabled={Boolean(result) || pending}>
            Check
          </button>
        </form>
      )}

      {result && (
        <section className="card space-y-3 p-5">
          <p className={`text-lg font-bold ${result.correct ? "text-good" : "text-ink"}`}>
            {result.correct ? "✓ Correct!" : `Not quite. The answer is ${result.answer}.`}
          </p>
          <p className="text-[15px] leading-relaxed">{result.explanation}</p>
          <TutorPanel key={question.id} kind="question" id={question.id} label={result.correct ? "🤔 Explain it more" : undefined} />

          {!result.correct && (
            <div className="space-y-2 border-t border-line pt-3">
              {result.savedToLog || missTag ? (
                <p className="text-sm text-good">📕 Saved to your error log. It comes back tomorrow.</p>
              ) : (
                <p className="text-sm text-muted">Tag why you missed it to save it to your error log.</p>
              )}
              <p className="text-sm font-medium">
                Why did you miss it? {result.savedToLog && <span className="font-normal text-muted">(optional)</span>}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(REASONS) as Reason[]).map((r) => (
                  <button
                    key={r}
                    aria-pressed={missTag === r}
                    className={`rounded-xl border p-2.5 text-left text-sm ${missTag === r ? "border-accent bg-accent-soft" : "border-line"}`}
                    onClick={() => tagMiss(r)}
                  >
                    {REASONS[r].icon} {REASONS[r].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="btn-primary w-full" onClick={next} disabled={pending}>
            {slot + 1 >= planned ? "Finish" : "Next question"}
          </button>
        </section>
      )}
      {error && <p className="text-center text-sm text-bad">{error}</p>}
    </div>
  );
}
