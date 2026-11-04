// Shapes a timed module like a real digital SAT module.
//
// Reading & Writing: 27 questions, 32 minutes, grouped by question type in SAT order
// (Craft & Structure → Information & Ideas → Standard English Conventions → Expression of
// Ideas), easier to harder within each type.
// Math: 22 questions, 35 minutes, all four domains mixed, easier to harder overall.
//
// Module 2 is adaptive like the SAT: a strong Module 1 leads to a harder Module 2.

import type { Difficulty } from "@/lib/errors";
import type { Section } from "@/lib/skills";

export type Tier = "standard" | "harder" | "easier";
export type ModuleNo = 1 | 2;

export const FORMAT: Record<Section, { questions: number; seconds: number; label: string }> = {
  rw: { questions: 27, seconds: 32 * 60, label: "Reading and Writing" },
  math: { questions: 22, seconds: 35 * 60, label: "Math" },
};

// Module 1 accuracy at or above this unlocks the harder Module 2 (College Board doesn't
// publish its routing cutoff; ~70% is a common estimate).
export const HARDER_CUTOFF = 0.7;

// Reading & Writing: how many of each question type, in the order they appear.
export const RW_BLUEPRINT: { skill: string; count: number }[] = [
  { skill: "words_in_context", count: 3 },
  { skill: "text_structure", count: 2 },
  { skill: "cross_text", count: 2 },
  { skill: "central_ideas", count: 2 },
  { skill: "evidence_textual", count: 2 },
  { skill: "evidence_quantitative", count: 1 },
  { skill: "inferences", count: 2 },
  { skill: "boundaries", count: 4 },
  { skill: "form_structure_sense", count: 3 },
  { skill: "transitions", count: 3 },
  { skill: "rhetorical_synthesis", count: 3 },
];

// Math: questions per domain; skills within a domain are chosen weakest-first.
export const MATH_DOMAINS: { domain: string; count: number }[] = [
  { domain: "algebra", count: 7 },
  { domain: "advanced_math", count: 7 },
  { domain: "psda", count: 4 },
  { domain: "geo_trig", count: 4 },
];

const MIX: Record<Section, Record<Tier, Record<Difficulty, number>>> = {
  rw: {
    standard: { easy: 9, medium: 9, hard: 9 },
    harder: { easy: 4, medium: 9, hard: 14 },
    easier: { easy: 14, medium: 9, hard: 4 },
  },
  math: {
    standard: { easy: 7, medium: 8, hard: 7 },
    harder: { easy: 3, medium: 8, hard: 11 },
    easier: { easy: 11, medium: 8, hard: 3 },
  },
};

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

export type Slot = { position: number; skill_id: string; difficulty: Difficulty };
export type SkillInfo = { id: string; domain_id: string; sort: number; accuracy: number | null };

// Spreads the difficulty counts evenly along the module so every question-type group
// gets its share of easy, medium and hard.
export function spreadDifficulties(counts: Record<Difficulty, number>): Difficulty[] {
  const total = counts.easy + counts.medium + counts.hard;
  const used: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const out: Difficulty[] = [];
  for (let i = 0; i < total; i++) {
    let best: Difficulty = "easy";
    let bestGap = -Infinity;
    for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
      if (used[d] >= counts[d]) continue;
      const gap = (counts[d] * (i + 1)) / total - used[d];
      if (gap > bestGap) {
        bestGap = gap;
        best = d;
      }
    }
    used[best]++;
    out.push(best);
  }
  return out;
}

export function buildSlots(section: Section, tier: Tier, skills: SkillInfo[]): Slot[] {
  const difficulties = spreadDifficulties(MIX[section][tier]);

  // 1. Pick the skill for each question, in blueprint order.
  const skillIds: string[] = [];
  if (section === "rw") {
    for (const { skill, count } of RW_BLUEPRINT) for (let i = 0; i < count; i++) skillIds.push(skill);
  } else {
    for (const { domain, count } of MATH_DOMAINS) {
      // Weakest skills first (untested in the middle), then round-robin.
      const inDomain = skills
        .filter((s) => s.domain_id === domain)
        .sort((a, b) => (a.accuracy ?? 0.65) - (b.accuracy ?? 0.65) || a.sort - b.sort);
      for (let i = 0; i < count; i++) skillIds.push(inDomain[i % inDomain.length].id);
    }
  }

  // 2. Pair skills with the evenly spread difficulties.
  const paired = skillIds.map((skill_id, i) => ({ skill_id, difficulty: difficulties[i] }));

  // 3. Order like the SAT: R&W keeps its type groups and goes easy→hard inside each;
  //    Math goes easy→hard across the whole module (stable, so domains stay mixed).
  let ordered: { skill_id: string; difficulty: Difficulty }[];
  if (section === "rw") {
    ordered = [];
    for (const { skill } of RW_BLUEPRINT) {
      ordered.push(...paired.filter((p) => p.skill_id === skill).sort((a, b) => RANK[a.difficulty] - RANK[b.difficulty]));
    }
  } else {
    ordered = paired
      .map((p, i) => ({ p, key: RANK[p.difficulty] * 100 + ((i * 7) % 22) }))
      .sort((a, b) => a.key - b.key)
      .map(({ p }) => p);
  }
  return ordered.map((p, i) => ({ position: i + 1, ...p }));
}

export function tierFromScore(score: number, total: number): Tier {
  return total > 0 && score / total >= HARDER_CUTOFF ? "harder" : "easier";
}

export type PastModule = { id: string; section: Section; module_no: ModuleNo; score: number | null; total: number; parent_id: string | null };

// Which module comes next. `history` is submitted modules, newest first.
// One section in focus: alternate M1, M2, M1, M2… Both in focus: finish each M1/M2 pair,
// then switch sections.
export function nextModule(
  history: PastModule[],
  focus: Section | "both",
): { section: Section; moduleNo: ModuleNo; tier: Tier; parentId: string | null } {
  const relevant = focus === "both" ? history : history.filter((m) => m.section === focus);
  const last = relevant[0];
  if (last && last.module_no === 1) {
    return { section: last.section, moduleNo: 2, tier: tierFromScore(last.score ?? 0, last.total), parentId: last.id };
  }
  const section: Section = focus !== "both" ? focus : last ? (last.section === "rw" ? "math" : "rw") : "rw";
  return { section, moduleNo: 1, tier: "standard", parentId: null };
}

// Target pace: the module's time split evenly across its questions.
export function targetSeconds(section: Section) {
  return Math.round(FORMAT[section].seconds / FORMAT[section].questions);
}
