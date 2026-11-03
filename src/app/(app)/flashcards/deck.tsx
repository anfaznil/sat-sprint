"use client";

import { useState, useTransition } from "react";
import { reviewFlashcard } from "./actions";
import { IconTile } from "@/components/icon-tile";
import { PartyPopper, Sparkles } from "lucide-react";

export type Card = { id: string; topic: string; front: string; back: string; isNew?: boolean };

export function Deck({ cards: initial, topics }: { cards: Card[]; topics: Record<string, string> }) {
  // Snapshot: the page refreshes after each grade, but the deck in hand shouldn't shift.
  const [cards] = useState(initial);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [right, setRight] = useState(0);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (cards.length === 0) {
    return (
      <section className="card p-6 text-center">
        <IconTile icon={Sparkles} />
        <p className="mt-2 font-semibold">No cards due right now</p>
        <p className="mt-1 text-sm text-muted">Everything you&apos;ve started is scheduled. Come back tomorrow.</p>
      </section>
    );
  }

  if (index >= cards.length) {
    return (
      <section className="card p-6 text-center">
        <IconTile icon={PartyPopper} tone="good" />
        <p className="mt-2 text-lg font-semibold">Deck done</p>
        <p className="mt-1 text-sm text-muted">
          {right} of {cards.length} you knew. The rest come back tomorrow.
        </p>
      </section>
    );
  }

  const card = cards[index];

  function grade(correct: boolean) {
    setFailed(false);
    startTransition(async () => {
      try {
        await reviewFlashcard(card.id, correct);
        if (correct) setRight((r) => r + 1);
        setFlipped(false);
        setIndex((i) => i + 1);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {topics[card.topic]}
          {card.isNew && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">New</span>}
        </span>
        <span className="tabular-nums">
          {index + 1}/{cards.length}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="card block min-h-56 w-full p-6 text-left transition active:scale-[0.99]"
        aria-label={flipped ? "Card answer. Tap to see the question." : "Card question. Tap to see the answer."}
      >
        <p className="text-lg font-semibold leading-snug">{card.front}</p>
        {flipped ? (
          <p className="mt-4 whitespace-pre-wrap border-t border-line pt-4 text-[15px] leading-relaxed">{card.back}</p>
        ) : (
          <p className="mt-6 text-sm text-muted">Say your answer, then tap to check.</p>
        )}
      </button>
      {flipped && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" disabled={pending} onClick={() => grade(false)}>
            {card.isNew ? "Learning it" : "✗ Missed it"}
          </button>
          <button className="btn-primary bg-good" disabled={pending} onClick={() => grade(true)}>
            {card.isNew ? "Knew it" : "✓ Got it"}
          </button>
        </div>
      )}
      {failed && <p className="text-center text-sm text-bad">Couldn&apos;t save that. Tap again.</p>}
    </section>
  );
}
