import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { TOPICS } from "@/lib/flashcards";
import { Quiz, type QuizCard } from "./quiz";

const NEW_PER_SESSION = 6;

export default function FlashcardsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grammar cards</h1>
        <p className="mt-1 text-sm text-muted">
          SAT-style questions on the punctuation and grammar rules the test loves. Each rule comes back after 1, 3, then
          7 days, with a new sentence each time.
        </p>
      </div>
      <Suspense fallback={<div className="card h-72 animate-pulse" />}>
        <Cards />
      </Suspense>
    </div>
  );
}

type Row = {
  id: string;
  topic: string;
  front: string;
  back: string;
  sort: number;
  flashcard_state: { stage: number; next_review_on: string; cleared_at: string | null; reviews: number } | null;
  flashcard_questions: { id: string; variant: number; stem: string; choices: string[] }[];
};

async function Cards() {
  await requireMember();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, topic, front, back, sort, flashcard_state(stage, next_review_on, cleared_at, reviews), flashcard_questions(id, variant, stem, choices)")
    .order("topic")
    .order("sort");
  if (error) throw error;
  const cards = data as unknown as Row[];
  const now = today();
  const order = Object.keys(TOPICS);

  const due = cards.filter((c) => c.flashcard_state && !c.flashcard_state.cleared_at && c.flashcard_state.next_review_on <= now);
  // Introduce new rules a topic at a time, in the order they're written.
  const fresh = cards
    .filter((c) => !c.flashcard_state)
    .sort((a, b) => order.indexOf(a.topic) - order.indexOf(b.topic) || a.sort - b.sort)
    .slice(0, NEW_PER_SESSION);

  // Each review of a rule shows its next question, so the sentence is new every time.
  const deck: QuizCard[] = [...due, ...fresh].flatMap((c) => {
    const questions = [...c.flashcard_questions].sort((a, b) => a.variant - b.variant);
    if (questions.length === 0) return [];
    const q = questions[(c.flashcard_state?.reviews ?? 0) % questions.length];
    return [{ cardId: c.id, topic: c.topic, isNew: !c.flashcard_state, question: { id: q.id, stem: q.stem, choices: q.choices } }];
  });

  return (
    <>
      <Quiz cards={deck} topics={TOPICS} />

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Progress</h2>
        <ul className="space-y-3">
          {order.map((topic) => {
            const inTopic = cards.filter((c) => c.topic === topic);
            const mastered = inTopic.filter((c) => c.flashcard_state?.cleared_at).length;
            const learning = inTopic.filter((c) => c.flashcard_state && !c.flashcard_state.cleared_at).length;
            return (
              <li key={topic}>
                <div className="flex justify-between text-sm">
                  <span>{TOPICS[topic]}</span>
                  <span className="tabular-nums text-muted">
                    {mastered}/{inTopic.length} mastered
                  </span>
                </div>
                <div className="mt-1 flex h-2 gap-0.5 overflow-hidden rounded bg-line/70">
                  <div className="h-full rounded bg-good" style={{ width: `${(mastered / inTopic.length) * 100}%` }} />
                  <div className="h-full rounded bg-accent/60" style={{ width: `${(learning / inTopic.length) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          <span className="text-good">■</span> mastered <span className="ml-2 text-accent/60">■</span> learning
        </p>
      </section>

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Study the rules</summary>
        {order.map((topic) => (
          <div key={topic} className="mt-4">
            <h3 className="text-sm font-semibold text-rw">{TOPICS[topic]}</h3>
            <ul className="mt-2 space-y-3">
              {cards
                .filter((c) => c.topic === topic)
                .map((c) => (
                  <li key={c.id} className="text-sm">
                    <p className="font-medium">{c.front}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-muted">{c.back}</p>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </details>
    </>
  );
}
