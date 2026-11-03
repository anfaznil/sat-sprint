// XP is derived from what she has already done, so there's nothing extra to store or sync.
export const XP = {
  drillRight: 10,
  drillWrong: 3, // effort counts
  reviewRight: 8,
  reviewWrong: 3,
  drillComplete: 25,
  missLogged: 5,
  practiceTest: 50,
  cardStarted: 2,
  cardMastered: 10,
} as const;

export type XpCounts = {
  drillRight: number;
  drillWrong: number;
  reviewRight: number;
  reviewWrong: number;
  drillsCompleted: number;
  missesLogged: number;
  practiceTests: number;
  cardsStarted: number;
  cardsMastered: number;
};

export function totalXp(c: XpCounts) {
  return (
    c.drillRight * XP.drillRight +
    c.drillWrong * XP.drillWrong +
    c.reviewRight * XP.reviewRight +
    c.reviewWrong * XP.reviewWrong +
    c.drillsCompleted * XP.drillComplete +
    c.missesLogged * XP.missLogged +
    c.practiceTests * XP.practiceTest +
    c.cardsStarted * XP.cardStarted +
    c.cardsMastered * XP.cardMastered
  );
}

// Level 1 → 2 takes 100 XP, and each level after takes 50 more than the last.
export function levelFor(xp: number) {
  let level = 1;
  let floor = 0;
  let span = 100;
  while (xp >= floor + span) {
    floor += span;
    level++;
    span += 50;
  }
  return { level, into: xp - floor, span };
}

// XP from one drill sitting, for the done screen.
export function drillXp(right: number, answered: number, reviews: { right: number; total: number } | null, completed: boolean) {
  return (
    right * XP.drillRight +
    (answered - right) * XP.drillWrong +
    (reviews ? reviews.right * XP.reviewRight + (reviews.total - reviews.right) * XP.reviewWrong : 0) +
    (completed ? XP.drillComplete : 0)
  );
}
