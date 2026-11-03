"use client";

import { useState, useTransition } from "react";
import { BookOpen, Check, PartyPopper, Sparkles, X } from "lucide-react";
import { IconTile } from "@/components/icon-tile";
import { celebrate } from "@/lib/celebrate";
import { answerFlashcard, type CardResult } from "./actions";

export type QuizCard = {
  cardId: string;
  topic: string;
  isNew: boolean;
  question: { id: string; stem: string; choices: string[] };
};

const LETTERS = ["A", "B", "C", "D"];

export function Quiz({ cards: initial, topics }: { cards: QuizCard[]; topics: Record<string, string> }) {
  // Snapshot: the page refreshes after each answer, but the deck in hand shouldn't shift.
  const [cards] = useState(initial);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<CardResult | null>(null);
  const [right, setRight] = useState(0);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (cards.length === 0) {
    return (
      <section className="card p-6 text-center">
        <IconTile icon={Sparkles} />
        <p className="mt-3 font-semibold">No grammar questions due right now</p>
        <p className="mt-1 text-sm text-muted">Everything you&apos;ve started is scheduled. Come back tomorrow.</p>
      </section>
    );
  }

  if (index >= cards.length) {
    return (
      <section className="card p-6 text-center">
        <IconTile icon={PartyPopper} tone="good" size="lg" />
        <p className="mt-3 text-3xl font-bold tabular-nums">
          {right}
          <span className="text-xl text-muted"> / {cards.length}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {right === cards.length ? "Perfect set. Those rules are sticking." : "The ones you missed come back tomorrow with a new sentence."}
        </p>
      </section>
    );
  }

  const card = cards[index];
  const [before, after] = card.question.stem.split("____");
  const answerIndex = result ? LETTERS.indexOf(result.answer) : -1;

  function choose(letter: string) {
    if (result || pending) return;
    setChosen(letter);
    setFailed(false);
    startTransition(async () => {
      try {
        const r = await answerFlashcard(card.question.id, letter);
        setResult(r);
        if (r.correct) {
          setRight((n) => n + 1);
          navigator.vibrate?.(35);
        }
      } catch {
        setChosen(null);
        setFailed(true);
      }
    });
  }

  function next() {
    const isLast = index + 1 >= cards.length;
    if (isLast && right === cards.length) celebrate();
    setIndex((i) => i + 1);
    setChosen(null);
    setResult(null);
    window.scrollTo({ top: 0 });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded bg-line/70">
          <div className="h-full rounded bg-rw transition-all" style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted">
          {index + 1}/{cards.length}
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-2.5">
          <span className="rounded-full bg-rw/12 px-2 py-0.5 text-[11px] font-semibold text-rw">{topics[card.topic]}</span>
          {card.isNew && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">New rule</span>}
        </div>
        <p className="px-5 pt-5 font-serif text-[18px] leading-[1.7]">
          {before}
          <span className="mx-0.5 inline-block min-w-16 border-b-2 border-ink/70 align-baseline" aria-label="blank">
            &nbsp;
          </span>
          {after}
        </p>
        <p className="px-5 pb-4 pt-3 text-[15px] font-semibold">
          {card.topic === "transitions"
            ? "Which choice completes the text with the most logical transition?"
            : "Which choice completes the text so that it conforms to the conventions of Standard English?"}
        </p>
      </div>

      <ol className="space-y-2">
        {card.question.choices.map((choice, i) => {
          const letter = LETTERS[i];
          const isAnswer = result && i === answerIndex;
          const isWrongPick = result && !result.correct && chosen === letter;
          return (
            <li key={letter}>
              <button
                disabled={Boolean(result) || pending}
                onClick={() => choose(letter)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-left transition active:scale-[0.99] ${
                  isAnswer
                    ? "animate-pop border-good bg-good/10"
                    : isWrongPick
                      ? "animate-shake border-bad bg-bad/10"
                      : pending && chosen === letter
                        ? "border-accent bg-accent-soft"
                        : result
                          ? "border-line opacity-55"
                          : "border-line"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                    isAnswer
                      ? "border-good bg-good text-white"
                      : isWrongPick
                        ? "border-bad bg-bad text-white"
                        : pending && chosen === letter
                          ? "border-accent bg-accent text-white"
                          : "border-ink/70 text-ink"
                  }`}
                >
                  {isAnswer ? <Check aria-label="Correct" className="size-4" strokeWidth={3} /> : isWrongPick ? <X aria-label="Your answer" className="size-4" strokeWidth={3} /> : letter}
                </span>
                <span className="font-serif text-[17px]">{choice}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {failed && <p className="text-center text-sm text-bad">Couldn&apos;t save that. Tap again.</p>}

      {result && (
        <div className="card space-y-3 p-5">
          <p className={`animate-rise text-lg font-bold ${result.correct ? "text-good" : "text-ink"}`}>
            {result.correct ? "✓ Correct!" : `Not quite. The answer is ${result.answer}.`}
          </p>
          <div className="rounded-xl bg-rw/8 p-4">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rw">
              <BookOpen aria-hidden className="size-3.5" /> The rule
            </p>
            <p className="font-medium">{result.rule.front}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{result.rule.back}</p>
          </div>
          {result.next && (
            <p className="text-sm text-muted">
              {result.next === "mastered" ? "Mastered! This rule is off your list." : `This rule comes back ${result.next} with a new sentence.`}
            </p>
          )}
          <button className="btn-primary w-full" onClick={next}>
            {index + 1 >= cards.length ? "Finish" : "Next"}
          </button>
        </div>
      )}
    </section>
  );
}
