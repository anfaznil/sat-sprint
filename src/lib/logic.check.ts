// Checks for the pure logic (spaced review, drill planning, grading, question validation).
// Run with: npm test
import { applyReview, firstReview } from "./spaced";
import { computeStreak } from "./drill/streak";
import { pickDifficulty, pickFocusSkills, plannedNewQuestions } from "./drill/plan";
import type { Domain, Skill, SkillStat } from "./skills";
import { levelFor, totalXp } from "./xp";
import BANK from "./modules/question-bank.json";
import { buildSlots, nextModule, spreadDifficulties, targetSeconds, type SkillInfo } from "./modules/blueprint";
import { isCorrect, validateQuestion } from "./drill/validate";
import { buildPlan, dayKind } from "./plan";
import { createSession, passcodeMatches, verifySession } from "./session";
const eq = (a: unknown, b: unknown, label: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", label, a, "!=", b); process.exitCode = 1; }
};
eq(firstReview("2026-11-28"), "2026-11-29", "first review");
eq(applyReview(1, true, "2026-11-28"), { cleared: false, stage: 2, nextReviewOn: "2026-12-01" }, "stage 1 -> 2");
eq(applyReview(2, true, "2026-11-28"), { cleared: false, stage: 3, nextReviewOn: "2026-12-05" }, "stage 2 -> 3");
eq(applyReview(3, true, "2026-11-28"), { cleared: true, stage: 3, nextReviewOn: null }, "stage 3 clears");
eq(applyReview(3, false, "2026-12-31"), { cleared: false, stage: 1, nextReviewOn: "2027-01-01" }, "miss resets");
eq(computeStreak(["2026-11-01", "2026-11-02", "2026-10-31"], "2026-11-02"), 3, "streak incl today");
eq(computeStreak(["2026-11-01", "2026-10-31"], "2026-11-02"), 2, "streak, today not done yet");
eq(computeStreak(["2026-10-30"], "2026-11-02"), 0, "broken streak");
eq(plannedNewQuestions(0, "2026-11-10"), 15, "plan 0 due"); eq(plannedNewQuestions(30, "2026-11-10"), 8, "plan floor");
eq(plannedNewQuestions(0, "2026-12-03"), 0, "light day Thu"); eq(plannedNewQuestions(0, "2026-12-04"), 0, "light day Fri");
eq(plannedNewQuestions(0, "2026-12-02"), 15, "Wed before is normal");
eq([dayKind("2026-11-07"), dayKind("2026-11-28"), dayKind("2026-12-05"), dayKind("2026-11-09")], ["practice", "practice", "test", "drill"], "day kinds");
const plan = buildPlan("2026-11-04");
eq(plan[0].days[0].date, "2026-11-02", "plan starts Monday"); eq(plan.at(-1)!.days.at(-1)!.date, "2026-12-05", "plan ends test day");
eq(plan.flatMap((w) => w.days).find((d) => d.date === "2026-11-08")?.note, "Log yesterday's misses first", "sunday note");
eq(pickDifficulty(null, []), "medium", "diff null"); eq(pickDifficulty(0.3, []), "easy", "diff low");
eq(pickDifficulty(0.6, [true, true, true]), "hard", "diff bump up"); eq(pickDifficulty(0.9, [false, false, false, true]), "medium", "diff bump down");
eq(isCorrect("7/2", "3.5", false), true, "spr fraction"); eq(isCorrect("B", "b", true), true, "mc case");
eq(isCorrect(".5", "0.5", false), true, "spr leading dot"); eq(isCorrect("12", "13", false), false, "spr wrong");
const base = { passage: "", stem: "If 3x + 5 = 20, what is x?", explanation: "Subtract 5 then divide by 3 to get x = 5." };
eq(validateQuestion({ ...base, choices: ["A) 3", "B) 5", "C) 15", "D) 25"], answer: "B" }, "math").ok, true, "valid mc + strips prefixes");
eq(validateQuestion({ ...base, choices: ["3", "5", "5", "25"], answer: "B" }, "math").ok, false, "dup choices");
eq(validateQuestion({ ...base, choices: [], answer: "5" }, "math").ok, true, "valid spr");
eq(validateQuestion({ ...base, choices: [], answer: "five" }, "math").ok, false, "spr non-numeric");
eq(validateQuestion({ ...base, choices: ["a", "b", "c", "d"], answer: "B" }, "rw").ok, false, "rw needs passage");
eq(validateQuestion({ ...base, stem: "Find \\frac{1}{2} of x", choices: ["1", "2", "3", "4"], answer: "A" }, "math").ok, false, "latex");
eq(validateQuestion({ ...base, choices: ["1", "2", "3", "4"], answer: "E" }, "math").ok, false, "bad letter");
// Section focus: drills only pick skills from the section in focus.
const rw: Domain = { id: "craft", section: "rw", name: "Craft", weight: 0.28, sort: 1 };
const math: Domain = { id: "algebra", section: "math", name: "Algebra", weight: 0.35, sort: 2 };
const sk = (id: string, d: Domain): Skill => ({ id, domain_id: d.id, name: id, sort: 1 });
const stat = (id: string, d: Domain, accuracy: number): SkillStat =>
  ({ skill: sk(id, d), domain: d, correct: 0, total: 1, accuracy, latest: accuracy, previous: null, tests: 1 });
const rankedFixture = [stat("m1", math, 0.2), stat("r1", rw, 0.3), stat("m2", math, 0.4), stat("r2", rw, 0.5)];
const untestedFixture = [{ skill: sk("r3", rw), domain: rw }, { skill: sk("m3", math), domain: math }];
eq(pickFocusSkills(rankedFixture, untestedFixture, "both").map((f) => f.skill.id), ["m1", "r1", "m2"], "focus both");
eq(pickFocusSkills(rankedFixture, untestedFixture, "rw").map((f) => f.skill.id), ["r1", "r2", "r3"], "focus rw fills with untested rw");
eq(pickFocusSkills([], untestedFixture, "math").map((f) => f.skill.id), ["m3"], "focus math, little data");

// XP and levels
eq(levelFor(0), { level: 1, into: 0, span: 100 }, "level 1 start");
eq(levelFor(99), { level: 1, into: 99, span: 100 }, "just under level 2");
eq(levelFor(100), { level: 2, into: 0, span: 150 }, "level 2");
eq(levelFor(260), { level: 3, into: 10, span: 200 }, "level 3");
eq(totalXp({ drillRight: 1, drillWrong: 1, reviewRight: 1, reviewWrong: 1, drillsCompleted: 1, missesLogged: 1, practiceTests: 1, cardsStarted: 1, cardsMastered: 1 }),
  10 + 3 + 8 + 3 + 25 + 5 + 50 + 2 + 10, "total xp");

// Question bank the app loads itself
eq(BANK.length, 162, "bank size");
eq(BANK.every((q) => q.choices.length === 4 && "ABCD".includes(q.answer) && q.stem && q.explanation), true, "bank rows complete");
eq(new Set(BANK.map((q) => `${q.passage}|${q.stem}`)).size, 162, "bank rows unique");

// Timed modules
const mathSkills: SkillInfo[] = [
  { id: "linear_functions", domain_id: "algebra", sort: 2, accuracy: 0.4 },
  { id: "systems_linear", domain_id: "algebra", sort: 4, accuracy: null },
  { id: "linear_eq_one_var", domain_id: "algebra", sort: 1, accuracy: 0.9 },
  { id: "nonlinear_functions", domain_id: "advanced_math", sort: 3, accuracy: 0.5 },
  { id: "equivalent_expressions", domain_id: "advanced_math", sort: 1, accuracy: 0.8 },
  { id: "percentages", domain_id: "psda", sort: 2, accuracy: null },
  { id: "circles", domain_id: "geo_trig", sort: 4, accuracy: 0.3 },
];
const rwSlots = buildSlots("rw", "standard", []);
eq(rwSlots.length, 27, "rw module has 27 questions");
eq(rwSlots.map((s) => s.position), Array.from({ length: 27 }, (_, i) => i + 1), "positions 1..27");
eq(rwSlots[0].skill_id, "words_in_context", "rw starts with words in context");
eq(rwSlots.at(-1)!.skill_id, "rhetorical_synthesis", "rw ends with rhetorical synthesis");
eq(rwSlots.filter((s) => s.skill_id === "boundaries").length, 4, "4 boundaries questions");
const rank = { easy: 0, medium: 1, hard: 2 } as const;
eq(rwSlots.filter((s) => s.skill_id === "boundaries").every((s, i, a) => i === 0 || rank[a[i - 1].difficulty] <= rank[s.difficulty]), true, "easy→hard within a type");
const countBy = (slots: { difficulty: string }[]) =>
  Object.fromEntries(["easy", "medium", "hard"].map((d) => [d, slots.filter((s) => s.difficulty === d).length]));
eq(countBy(rwSlots), { easy: 9, medium: 9, hard: 9 }, "standard mix");
eq(countBy(buildSlots("rw", "harder", [])), { easy: 4, medium: 9, hard: 14 }, "harder mix");
const mathSlots = buildSlots("math", "standard", mathSkills);
eq(mathSlots.length, 22, "math module has 22 questions");
eq(mathSlots.every((s, i, a) => i === 0 || rank[a[i - 1].difficulty] <= rank[s.difficulty]), true, "math easy→hard overall");
eq(mathSlots.filter((s) => s.skill_id === "linear_functions").length >= mathSlots.filter((s) => s.skill_id === "linear_eq_one_var").length, true, "weak skills get more");
eq(spreadDifficulties({ easy: 1, medium: 1, hard: 1 }).length, 3, "spread length");
eq(targetSeconds("rw"), 71, "rw pace ~71s"); eq(targetSeconds("math"), 95, "math pace ~95s");
const m1 = { id: "m1", section: "rw" as const, module_no: 1 as const, score: 20, total: 27, parent_id: null };
eq(nextModule([], "rw"), { section: "rw", moduleNo: 1, tier: "standard", parentId: null }, "first module");
eq(nextModule([m1], "rw"), { section: "rw", moduleNo: 2, tier: "harder", parentId: "m1" }, "M1 20/27 → harder M2");
eq(nextModule([{ ...m1, score: 15 }], "rw").tier, "easier", "M1 15/27 → easier M2");
eq(nextModule([{ ...m1, id: "m2", module_no: 2, parent_id: "m1" }, m1], "rw"), { section: "rw", moduleNo: 1, tier: "standard", parentId: null }, "after M2 → new M1");
eq(nextModule([{ ...m1, id: "m2", module_no: 2, parent_id: "m1" }], "both").section, "math", "both: switch section after a pair");
eq(nextModule([m1], "math"), { section: "math", moduleNo: 1, tier: "standard", parentId: null }, "math focus ignores R&W history");

async function sessionChecks() {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.APP_PASSCODE = "maple river 42";
  const t0 = Date.parse("2026-11-02T12:00:00Z");
  const session = await createSession(t0);
  eq(await verifySession(session, t0 + 1000), true, "fresh session valid");
  eq(await verifySession(session, t0 + 366 * 86_400_000), false, "expired after a year");
  eq(await verifySession(session.slice(0, -2) + "xx", t0), false, "tampered signature");
  eq(await verifySession(session.replace(/^v1\.\d+/, `v1.${t0 + 999 * 86_400_000}`), t0), false, "extended expiry rejected");
  eq(await verifySession(undefined), false, "no cookie");
  eq(await passcodeMatches(" maple river 42 "), true, "passcode trims spaces");
  eq(await passcodeMatches("maple river 43"), false, "wrong passcode");
  process.env.APP_PASSCODE = "new passcode";
  eq(await verifySession(session, t0 + 1000), false, "changing passcode signs everyone out");
}

sessionChecks().then(() => console.log(process.exitCode ? "some checks failed" : "all checks passed"));
