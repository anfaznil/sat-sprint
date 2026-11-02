-- How many new questions today's drill holds. Fixed when the day's drill starts,
-- so finishing reviews mid-drill doesn't move the finish line.
alter table public.drill_sessions
  add column planned_new int not null default 12 check (planned_new between 1 and 30);
