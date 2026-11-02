import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/auth";
import type { Difficulty } from "@/lib/errors";
import { AiLimitError, AiUnavailableError } from "@/lib/ai/claude";
import { countAnswered, getFocusSkills, getTodaySession } from "@/lib/data/drill";
import { generateQuestions } from "./generate";
import { pickDifficulty } from "./plan";

export type PlayerQuestion = {
  id: string;
  skillName: string;
  difficulty: Difficulty;
  passage: string | null;
  stem: string;
  choices: string[] | null;
};

export type NextResult =
  | { status: "question"; question: PlayerQuestion }
  | { status: "done" }
  | { status: "error"; message: string };

type QuestionRow = {
  id: string;
  skill_id: string;
  difficulty: Difficulty;
  passage: string | null;
  stem: string;
  choices: string[] | null;
};

const QUESTION_COLUMNS = "id, skill_id, difficulty, passage, stem, choices";

// The question for drill slot `slot` (0-based). The client asks for slot n+1 while she
// works on slot n, so `exclude` keeps it from getting the question already on screen.
export async function nextQuestion(member: Member, slot: number, exclude: string[]): Promise<NextResult> {
  const supabase = await createClient();
  const session = await getTodaySession(member.id);
  if (slot >= session.planned_new) {
    // Light days have 0 new questions: reaching the end of the reviews finishes the drill.
    if (!session.completed_at && (await countAnswered(session.id)) >= session.planned_new) {
      await supabase.from("drill_sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id);
    }
    return { status: "done" };
  }
  // Never serve past what she has actually answered plus the one being prefetched.
  if (slot > (await countAnswered(session.id)) + 1) return { status: "error", message: "Out of order. Reload the page." };

  const focus = await getFocusSkills();
  if (focus.length === 0) return { status: "error", message: "No skills found. Check the database seed." };
  const target = focus[slot % focus.length];

  // What she's already seen, and how she's done on this skill in drills lately.
  const { data: attempts, error: attemptsError } = await supabase
    .from("question_attempts")
    .select("question_id, correct, questions!inner(skill_id)")
    .eq("created_by", member.id)
    .order("answered_at", { ascending: false })
    .limit(1000);
  if (attemptsError) return { status: "error", message: attemptsError.message };
  const seen = new Set([...attempts.map((a) => a.question_id), ...exclude]);
  const recent = attempts
    .filter((a) => (a.questions as unknown as { skill_id: string }).skill_id === target.skill.id)
    .map((a) => a.correct);
  const difficulty = pickDifficulty(target.accuracy, recent);

  const { data: pool, error: poolError } = await supabase
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("skill_id", target.skill.id)
    .order("created_at", { ascending: false })
    .limit(300);
  if (poolError) return { status: "error", message: poolError.message };
  const unseen = (pool as QuestionRow[]).filter((q) => !seen.has(q.id));

  let question = unseen.find((q) => q.difficulty === difficulty);
  if (!question) {
    try {
      const fresh = await generateQuestions({
        skillId: target.skill.id,
        skillName: target.skill.name,
        domainName: target.domain.name,
        section: target.domain.section,
        difficulty,
        avoidStems: (pool as QuestionRow[]).slice(0, 15).map((q) => q.stem),
      });
      if (fresh.length > 0) {
        const { data: saved, error } = await supabase.from("questions").insert(fresh).select(QUESTION_COLUMNS);
        if (error) throw error;
        question = (saved as QuestionRow[])[0];
      }
    } catch (e) {
      // Fall back to an unseen question at another difficulty before giving up.
      question = unseen[0];
      if (!question) return { status: "error", message: friendlyAiError(e) };
    }
  }
  question ??= unseen[0];
  if (!question) return { status: "error", message: "Couldn't make a question just now. Try again in a minute." };

  return {
    status: "question",
    question: {
      id: question.id,
      skillName: target.skill.name,
      difficulty: question.difficulty,
      passage: question.passage,
      stem: question.stem,
      choices: question.choices,
    },
  };
}

function friendlyAiError(e: unknown) {
  if (e instanceof AiLimitError) return e.message;
  if (e instanceof AiUnavailableError) return "AI questions aren't set up yet (missing ANTHROPIC_API_KEY).";
  console.error("Question generation failed", e);
  return "Couldn't write new questions just now. Try again in a minute.";
}
