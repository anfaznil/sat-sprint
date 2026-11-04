import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STUDENT_ID } from "@/lib/auth";
import type { Difficulty } from "@/lib/errors";
import { rankSkills, type Section } from "@/lib/skills";
import { buildSlots, FORMAT, nextModule, type ModuleNo, type PastModule, type Tier } from "@/lib/modules/blueprint";
import { isCorrect } from "@/lib/drill/validate";
import { getSkillMap, getSkillResults } from "./skills";
import { getFocus } from "./settings";
import { getTodaySession } from "./drill";
import { saveMiss } from "./misses";

export type ModuleRow = {
  id: string;
  section: Section;
  module_no: ModuleNo;
  tier: Tier;
  parent_id: string | null;
  status: "preparing" | "ready" | "in_progress" | "submitted";
  total: number;
  time_limit_sec: number;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  score: number | null;
  session_id: string | null;
  created_at: string;
};

const MODULE_COLUMNS =
  "id, section, module_no, tier, parent_id, status, total, time_limit_sec, started_at, deadline_at, submitted_at, score, session_id, created_at";

// Answers saved a little after the deadline still count (slow networks, auto-submit).
const GRACE_MS = 15_000;

// Server clock for the timed screen (the phone's clock may be off).
export function serverTime() {
  return Date.now();
}

export function timeIsUp(mod: Pick<ModuleRow, "deadline_at">) {
  return Boolean(mod.deadline_at && Date.now() > Date.parse(mod.deadline_at) + GRACE_MS);
}

export async function getModule(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("modules").select(MODULE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ModuleRow | null;
}

export async function getSubmittedModules(limit = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .select(MODULE_COLUMNS)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ModuleRow[];
}

// The module she's working on: unfinished, or else a fresh one planned from her history.
// A module whose time ran out while she was away is submitted first.
export async function getOrCreateModule(): Promise<ModuleRow> {
  const supabase = await createClient();
  const { data: open, error } = await supabase
    .from("modules")
    .select(MODULE_COLUMNS)
    .neq("status", "submitted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (open) {
    const m = open as ModuleRow;
    if (m.status === "in_progress" && m.deadline_at && Date.now() > Date.parse(m.deadline_at) + GRACE_MS) {
      await submitModule(m.id);
    } else {
      return m;
    }
  }

  const [history, focus, { domains, skills }, results] = await Promise.all([
    getSubmittedModules(10),
    getFocus(),
    getSkillMap(),
    getSkillResults(),
  ]);
  const plan = nextModule(history as PastModule[], focus);

  const { ranked } = rankSkills(domains, skills, results);
  const accuracy = new Map(ranked.map((s) => [s.skill.id, s.accuracy]));
  const slots = buildSlots(
    plan.section,
    plan.tier,
    skills.map((s) => ({ id: s.id, domain_id: s.domain_id, sort: s.sort, accuracy: accuracy.get(s.id) ?? null })),
  );

  const { data: created, error: createError } = await supabase
    .from("modules")
    .insert({
      section: plan.section,
      module_no: plan.moduleNo,
      tier: plan.tier,
      parent_id: plan.parentId,
      total: slots.length,
      time_limit_sec: FORMAT[plan.section].seconds,
    })
    .select(MODULE_COLUMNS)
    .single();
  if (createError) throw createError;
  const { error: itemsError } = await supabase
    .from("module_items")
    .insert(slots.map((s) => ({ module_id: created.id, ...s })));
  if (itemsError) throw itemsError;

  const mod = created as ModuleRow;
  await prepareStep(mod.id);
  return (await getModule(mod.id))!;
}

type Item = { position: number; skill_id: string; difficulty: Difficulty; question_id: string | null };

async function seenQuestionIds() {
  const supabase = await createClient();
  const [attempts, assigned] = await Promise.all([
    supabase.from("question_attempts").select("question_id").limit(5000),
    supabase.from("module_items").select("question_id").not("question_id", "is", null).limit(5000),
  ]);
  return new Set([...(attempts.data ?? []), ...(assigned.data ?? [])].map((r) => r.question_id as string));
}

// Fills empty slots with questions she has never seen. With `relax`, a slot may take the
// closest available difficulty for its skill (used only after exact matches are exhausted).
async function fillFromBank(moduleId: string, relax = false) {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("module_items")
    .select("position, skill_id, difficulty, question_id")
    .eq("module_id", moduleId)
    .is("question_id", null)
    .order("position");
  const empty = (items ?? []) as Item[];
  if (empty.length === 0) return;

  const seen = await seenQuestionIds();
  const skillIds = [...new Set(empty.map((i) => i.skill_id))];
  const { data: pool } = await supabase
    .from("questions")
    .select("id, skill_id, difficulty")
    .in("skill_id", skillIds)
    .order("created_at", { ascending: false })
    .limit(1000);
  const available = ((pool ?? []) as { id: string; skill_id: string; difficulty: Difficulty }[]).filter((q) => !seen.has(q.id));

  const near: Record<Difficulty, Difficulty[]> = { easy: ["medium"], medium: ["easy", "hard"], hard: ["medium"] };
  for (const item of empty) {
    let index = available.findIndex((q) => q.skill_id === item.skill_id && q.difficulty === item.difficulty);
    if (index < 0 && relax) {
      index = available.findIndex((q) => q.skill_id === item.skill_id && near[item.difficulty].includes(q.difficulty));
      if (index < 0) index = available.findIndex((q) => q.skill_id === item.skill_id);
    }
    if (index < 0) continue;
    const [q] = available.splice(index, 1);
    // Only fill a slot that's still empty (another preparation request may have filled it).
    await supabase
      .from("module_items")
      .update({ question_id: q.id })
      .eq("module_id", moduleId)
      .eq("position", item.position)
      .is("question_id", null);
  }
}

export type PrepareResult = { filled: number; total: number; ready: boolean };

// Fills a module from the hand-written question bank (no paid API calls). Exact skill and
// difficulty matches go first, then the closest available difficulty for that skill.
export async function prepareStep(moduleId: string): Promise<PrepareResult> {
  const supabase = await createClient();
  const mod = await getModule(moduleId);
  if (!mod) return { filled: 0, total: 0, ready: false };

  if (mod.status === "preparing") {
    await fillFromBank(moduleId);
    await fillFromBank(moduleId, true);
  }

  const { count } = await supabase
    .from("module_items")
    .select("position", { count: "exact", head: true })
    .eq("module_id", moduleId)
    .not("question_id", "is", null);
  const filled = count ?? 0;
  const ready = filled >= mod.total;
  if (ready && mod.status === "preparing") {
    await supabase.from("modules").update({ status: "ready" }).eq("id", moduleId).eq("status", "preparing");
  }
  return { filled, total: mod.total, ready: ready || mod.status !== "preparing" };
}

// Starts the clock. The deadline lives on the server, so reloading or switching apps
// doesn't pause the timer (just like the real test).
export async function startModule(moduleId: string) {
  const supabase = await createClient();
  const mod = await getModule(moduleId);
  if (!mod) throw new Error("Module not found");
  if (mod.status === "in_progress" || mod.status === "submitted") return mod;
  if (mod.status !== "ready") throw new Error("Module isn't ready yet");

  const session = await getTodaySession(STUDENT_ID);
  const now = Date.now();
  const { data, error } = await supabase
    .from("modules")
    .update({
      status: "in_progress",
      started_at: new Date(now).toISOString(),
      deadline_at: new Date(now + mod.time_limit_sec * 1000).toISOString(),
      session_id: session.id,
    })
    .eq("id", moduleId)
    .eq("status", "ready")
    .select(MODULE_COLUMNS)
    .single();
  if (error) throw error;
  return data as ModuleRow;
}

export async function saveItem(
  moduleId: string,
  position: number,
  patch: { chosen?: string | null; marked?: boolean; addSeconds?: number },
) {
  const supabase = await createClient();
  const mod = await getModule(moduleId);
  if (!mod || mod.status !== "in_progress") return false;
  if (mod.deadline_at && Date.now() > Date.parse(mod.deadline_at) + GRACE_MS) return false;

  const update: Record<string, unknown> = {};
  if (patch.chosen !== undefined) update.chosen = patch.chosen ? patch.chosen.slice(0, 20) : null;
  if (patch.marked !== undefined) update.marked = patch.marked;
  if (patch.addSeconds) {
    const { data: row } = await supabase
      .from("module_items")
      .select("seconds")
      .eq("module_id", moduleId)
      .eq("position", position)
      .single();
    update.seconds = Math.min(3600, (row?.seconds ?? 0) + Math.max(0, Math.round(patch.addSeconds)));
  }
  if (Object.keys(update).length === 0) return true;
  const { error } = await supabase.from("module_items").update(update).eq("module_id", moduleId).eq("position", position);
  if (error) throw error;
  return true;
}

// Grades the module, records each answer, saves misses to the error log (blank answers
// are tagged "timing"), and counts the day's session as done.
export async function submitModule(moduleId: string) {
  const supabase = await createClient();
  const mod = await getModule(moduleId);
  if (!mod) throw new Error("Module not found");
  if (mod.status === "submitted") return mod;

  const { data: items, error } = await supabase
    .from("module_items")
    .select("position, question_id, chosen, seconds, questions(answer, choices)")
    .eq("module_id", moduleId)
    .order("position");
  if (error) throw error;

  let score = 0;
  const attempts: { question_id: string; session_id: string | null; chosen: string; correct: boolean; seconds: number }[] = [];
  const misses: { questionId: string; chosen: string; blank: boolean }[] = [];
  for (const item of items ?? []) {
    const q = item.questions as unknown as { answer: string; choices: string[] | null } | null;
    if (!item.question_id || !q) continue;
    const chosen = item.chosen ?? "";
    const correct = chosen !== "" && isCorrect(q.answer, chosen, q.choices !== null);
    if (correct) score++;
    await supabase.from("module_items").update({ correct }).eq("module_id", moduleId).eq("position", item.position);
    if (chosen) attempts.push({ question_id: item.question_id, session_id: mod.session_id, chosen, correct, seconds: item.seconds });
    if (!correct) misses.push({ questionId: item.question_id, chosen: chosen || "(no answer)", blank: !chosen });
  }

  const { data: done, error: updateError } = await supabase
    .from("modules")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), score })
    .eq("id", moduleId)
    .neq("status", "submitted")
    .select(MODULE_COLUMNS)
    .maybeSingle();
  if (updateError) throw updateError;
  if (!done) return (await getModule(moduleId))!; // submitted concurrently

  if (attempts.length) await supabase.from("question_attempts").insert(attempts);
  for (const m of misses) await saveMiss(m.questionId, m.chosen, m.blank ? "timing" : null);
  if (mod.session_id) {
    await supabase.from("drill_sessions").update({ completed_at: new Date().toISOString() }).eq("id", mod.session_id).is("completed_at", null);
  }
  revalidatePath("/", "layout");
  return done as ModuleRow;
}

// Today's module situation for Home and the plan, without creating anything:
// the open module (if any), what was finished today, and what comes next.
export async function getTodayModule(sessionId: string | null) {
  const supabase = await createClient();
  const [openRes, todayRes, history, focus] = await Promise.all([
    supabase.from("modules").select(MODULE_COLUMNS).neq("status", "submitted").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sessionId
      ? supabase.from("modules").select(MODULE_COLUMNS).eq("session_id", sessionId).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    getSubmittedModules(10),
    getFocus(),
  ]);
  const open = (openRes.data as ModuleRow | null) ?? null;
  const done = (todayRes.data as ModuleRow | null) ?? null;
  const next = open ? { section: open.section, moduleNo: open.module_no, tier: open.tier } : nextModule(history as PastModule[], focus);
  return { open, done, next };
}

export type RunItem = {
  position: number;
  skillName: string;
  question: { passage: string | null; stem: string; choices: string[] | null };
  chosen: string | null;
  marked: boolean;
};

// What the timed screen needs: questions without answer keys, plus her saved progress.
export async function getRunItems(moduleId: string): Promise<RunItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("module_items")
    .select("position, chosen, marked, skills(name), questions(passage, stem, choices)")
    .eq("module_id", moduleId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    position: r.position,
    skillName: (r.skills as unknown as { name: string }).name,
    question: r.questions as unknown as RunItem["question"],
    chosen: r.chosen,
    marked: r.marked,
  }));
}

export type ResultItem = {
  position: number;
  skillId: string;
  skillName: string;
  difficulty: Difficulty;
  chosen: string | null;
  correct: boolean | null;
  seconds: number;
  questionId: string | null;
  question: { passage: string | null; stem: string; choices: string[] | null; answer: string; explanation: string } | null;
};

// Full review data, only after the module is submitted.
export async function getResultItems(moduleId: string): Promise<ResultItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("module_items")
    .select("position, skill_id, difficulty, chosen, correct, seconds, question_id, skills(name), questions(passage, stem, choices, answer, explanation)")
    .eq("module_id", moduleId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    position: r.position,
    skillId: r.skill_id,
    skillName: (r.skills as unknown as { name: string }).name,
    difficulty: r.difficulty as Difficulty,
    chosen: r.chosen,
    correct: r.correct,
    seconds: r.seconds,
    questionId: r.question_id,
    question: r.questions as unknown as ResultItem["question"],
  }));
}
