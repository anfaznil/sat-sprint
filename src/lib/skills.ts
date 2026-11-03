export type Section = "math" | "rw";
// "both", or one section to concentrate on for this test date (superscoring).
export type Focus = Section | "both";

export type Domain = { id: string; section: Section; name: string; weight: number; sort: number };
export type Skill = { id: string; domain_id: string; name: string; sort: number };

export type ResultRow = {
  skill_id: string;
  correct: number;
  total: number;
  practice_tests: { taken_on: string; created_at: string };
};

export type SkillStat = {
  skill: Skill;
  domain: Domain;
  correct: number;
  total: number;
  accuracy: number; // 0..1 over the most recent tests
  latest: number; // accuracy on the most recent test with this skill
  previous: number | null;
  tests: number;
};

export const SECTION_LABEL: Record<Section, string> = { rw: "Reading & Writing", math: "Math" };
export const FOCUS_LABEL: Record<Focus, string> = { both: "Both sections", rw: "Reading & Writing", math: "Math" };

export function inFocus(section: Section, focus: Focus) {
  return focus === "both" || section === focus;
}

// How many recent tests count toward a skill's accuracy. Older tests fade out as she improves.
const RECENT_TESTS = 3;

export function rankSkills(domains: Domain[], skills: Skill[], results: ResultRow[]) {
  const domainById = new Map(domains.map((d) => [d.id, d]));
  const bySkill = new Map<string, ResultRow[]>();
  for (const r of results) {
    const list = bySkill.get(r.skill_id) ?? [];
    list.push(r);
    bySkill.set(r.skill_id, list);
  }

  const ranked: SkillStat[] = [];
  const untested: { skill: Skill; domain: Domain }[] = [];

  for (const skill of skills) {
    const domain = domainById.get(skill.domain_id)!;
    const rows = (bySkill.get(skill.id) ?? []).sort(
      (a, b) =>
        b.practice_tests.taken_on.localeCompare(a.practice_tests.taken_on) ||
        b.practice_tests.created_at.localeCompare(a.practice_tests.created_at),
    );
    if (rows.length === 0) {
      untested.push({ skill, domain });
      continue;
    }
    const recent = rows.slice(0, RECENT_TESTS);
    const correct = recent.reduce((s, r) => s + r.correct, 0);
    const total = recent.reduce((s, r) => s + r.total, 0);
    ranked.push({
      skill,
      domain,
      correct,
      total,
      accuracy: correct / total,
      latest: rows[0].correct / rows[0].total,
      previous: rows[1] ? rows[1].correct / rows[1].total : null,
      tests: rows.length,
    });
  }

  // Weakest first. On ties, the domain worth more questions on test day comes first.
  ranked.sort((a, b) => a.accuracy - b.accuracy || b.domain.weight - a.domain.weight || b.total - a.total);
  return { ranked, untested };
}

export function accuracyTone(accuracy: number) {
  if (accuracy < 0.6) return { label: "Focus", bar: "bg-bad", text: "text-bad" };
  if (accuracy < 0.8) return { label: "Building", bar: "bg-warn", text: "text-warn" };
  return { label: "Strong", bar: "bg-good", text: "text-good" };
}
