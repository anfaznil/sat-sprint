-- Timed modules: the daily session is one real-format SAT module
-- (R&W: 27 questions / 32 min; Math: 22 questions / 35 min), Module 1 then an adaptive
-- Module 2 (harder or easier depending on Module 1).

create table public.modules (
  id             uuid primary key default gen_random_uuid(),
  section        text not null check (section in ('rw', 'math')),
  module_no      int  not null check (module_no in (1, 2)),
  tier           text not null check (tier in ('standard', 'harder', 'easier')),
  parent_id      uuid references public.modules(id) on delete set null,  -- Module 1 that led to this Module 2
  status         text not null default 'preparing' check (status in ('preparing', 'ready', 'in_progress', 'submitted')),
  total          int  not null,
  time_limit_sec int  not null,
  started_at     timestamptz,
  deadline_at    timestamptz,
  submitted_at   timestamptz,
  score          int,
  session_id     uuid references public.drill_sessions(id) on delete set null,
  created_by     uuid not null default '00000000-0000-0000-0000-0000000a1ee0'::uuid,
  created_at     timestamptz not null default now()
);
create index on public.modules (created_by, created_at desc);

-- One row per question slot. The slot (skill + difficulty) is planned first; the question
-- is filled in while the module is being prepared.
create table public.module_items (
  module_id    uuid not null references public.modules(id) on delete cascade,
  position     int  not null,
  skill_id     text not null references public.skills(id),
  difficulty   text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_id  uuid references public.questions(id) on delete set null,
  chosen       text,
  marked       boolean not null default false,
  seconds      int not null default 0,
  correct      boolean,
  primary key (module_id, position)
);
create index on public.module_items (question_id);

alter table public.modules enable row level security;
alter table public.module_items enable row level security;
create policy "members only" on public.modules for all to authenticated
  using (public.is_member()) with check (public.is_member());
create policy "members only" on public.module_items for all to authenticated
  using (public.is_member()) with check (public.is_member());
