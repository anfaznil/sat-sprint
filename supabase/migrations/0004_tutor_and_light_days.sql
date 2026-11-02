-- Tutor: keep each assistant reply's raw content blocks so follow-ups replay the
-- conversation exactly as Claude produced it (required for thinking blocks).
alter table public.tutor_messages add column blocks jsonb;
create index on public.tutor_threads (error_id) where error_id is not null;
create index on public.tutor_threads (question_id) where question_id is not null;

-- Final two days before the test are light review only: a drill with 0 new questions.
alter table public.drill_sessions drop constraint if exists drill_sessions_planned_new_check;
alter table public.drill_sessions add constraint drill_sessions_planned_new_check check (planned_new between 0 and 30);
