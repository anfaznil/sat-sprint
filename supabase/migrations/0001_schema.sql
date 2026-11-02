-- SAT Sprint schema
-- One student's data, shared by a small allowlist of members (Aleena + helper).
-- Every table is protected by RLS: only emails listed in app_users can read/write.

-- ─────────────────────────────────────────────────────────────
-- Members / access control
-- ─────────────────────────────────────────────────────────────
create table public.app_users (
  email        text primary key check (email = lower(email)),
  display_name text not null,
  role         text not null default 'student' check (role in ('student', 'coach')),
  created_at   timestamptz not null default now()
);

-- True when the signed-in user's email is on the allowlist.
create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Lets the login page check an email before sending a magic link.
create or replace function public.email_is_allowed(p_email text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.app_users where email = lower(trim(p_email)));
$$;
revoke all on function public.email_is_allowed(text) from public;
grant execute on function public.email_is_allowed(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Feature 1: skill map + practice test results
-- ─────────────────────────────────────────────────────────────
create table public.domains (
  id       text primary key,
  section  text not null check (section in ('math', 'rw')),
  name     text not null,
  -- approximate share of the section's questions (College Board test specs)
  weight   numeric not null,
  sort     int  not null
);

create table public.skills (
  id        text primary key,
  domain_id text not null references public.domains(id),
  name      text not null,
  sort      int  not null
);

create table public.practice_tests (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  taken_on    date not null,
  rw_score    int check (rw_score between 200 and 800),
  math_score  int check (math_score between 200 and 800),
  created_by  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now()
);

create table public.skill_results (
  id        uuid primary key default gen_random_uuid(),
  test_id   uuid not null references public.practice_tests(id) on delete cascade,
  skill_id  text not null references public.skills(id),
  correct   int  not null check (correct >= 0),
  total     int  not null check (total > 0),
  check (correct <= total),
  unique (test_id, skill_id)
);
create index on public.skill_results (skill_id);

-- ─────────────────────────────────────────────────────────────
-- Feature 2: error log with spaced review (1 → 3 → 7 days)
-- stage 1 = due 1 day after logging / after a miss
-- stage 2 = due 3 days after a correct stage-1 review
-- stage 3 = due 7 days after a correct stage-2 review; correct here clears it
-- ─────────────────────────────────────────────────────────────
create table public.error_log (
  id              uuid primary key default gen_random_uuid(),
  section         text not null check (section in ('math', 'rw')),
  skill_id        text not null references public.skills(id),
  difficulty      text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_text   text not null,
  her_answer      text not null,
  correct_answer  text not null,
  reason          text not null check (reason in ('careless', 'concept_gap', 'timing', 'trap')),
  notes           text,
  screenshot_path text,
  question_id     uuid,  -- set when the miss came from a generated drill question
  stage           int  not null default 1 check (stage between 1 and 3),
  next_review_on  date not null default (current_date + 1),
  cleared_at      timestamptz,
  created_by      uuid not null default auth.uid() references auth.users(id),
  created_at      timestamptz not null default now()
);
create index on public.error_log (next_review_on) where cleared_at is null;

create table public.error_reviews (
  id          uuid primary key default gen_random_uuid(),
  error_id    uuid not null references public.error_log(id) on delete cascade,
  stage       int  not null,
  correct     boolean not null,
  reviewed_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Feature 3: daily drill with Claude-generated questions
-- ─────────────────────────────────────────────────────────────
create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  skill_id     text not null references public.skills(id),
  difficulty   text not null check (difficulty in ('easy', 'medium', 'hard')),
  passage      text,                -- R&W passage / math context (nullable)
  stem         text not null,
  choices      jsonb,               -- ["A text","B text","C text","D text"]; null = student-produced response
  answer       text not null,       -- "A".."D" or the numeric answer
  explanation  text not null,
  model        text not null,
  created_at   timestamptz not null default now(),
  check (choices is null or jsonb_array_length(choices) = 4)
);
create index on public.questions (skill_id, difficulty);

alter table public.error_log
  add constraint error_log_question_fk foreign key (question_id) references public.questions(id) on delete set null;

create table public.drill_sessions (
  id           uuid primary key default gen_random_uuid(),
  drill_date   date not null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  created_by   uuid not null default auth.uid() references auth.users(id),
  unique (created_by, drill_date)
);

create table public.question_attempts (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions(id) on delete cascade,
  session_id   uuid references public.drill_sessions(id) on delete set null,
  chosen       text not null,
  correct      boolean not null,
  seconds      int,
  created_by   uuid not null default auth.uid() references auth.users(id),
  answered_at  timestamptz not null default now()
);
create index on public.question_attempts (question_id);

-- ─────────────────────────────────────────────────────────────
-- Feature 4: "Why was I wrong?" tutor threads
-- ─────────────────────────────────────────────────────────────
create table public.tutor_threads (
  id           uuid primary key default gen_random_uuid(),
  error_id     uuid references public.error_log(id) on delete cascade,
  question_id  uuid references public.questions(id) on delete cascade,
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now()
);

create table public.tutor_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.tutor_threads(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index on public.tutor_messages (thread_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- Claude usage: per-user daily rate limit
-- ─────────────────────────────────────────────────────────────
create table public.ai_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  calls    int  not null default 0,
  primary key (user_id, day)
);

-- Atomically reserves one Claude call for today. Returns false when over the limit.
create or replace function public.consume_ai_call(p_day date, p_limit int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  used int;
begin
  if not public.is_member() then
    return false;
  end if;
  insert into public.ai_usage (user_id, day, calls)
  values (auth.uid(), p_day, 1)
  on conflict (user_id, day) do update set calls = ai_usage.calls + 1
  where ai_usage.calls < p_limit
  returning calls into used;
  return used is not null;
end;
$$;
revoke all on function public.consume_ai_call(date, int) from public;
grant execute on function public.consume_ai_call(date, int) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Feature 6: grammar flashcards (same 1 → 3 → 7 spaced review)
-- ─────────────────────────────────────────────────────────────
create table public.flashcards (
  id     uuid primary key default gen_random_uuid(),
  topic  text not null check (topic in ('commas', 'semicolons', 'colons', 'transitions', 'subject_verb')),
  front  text not null,
  back   text not null,
  sort   int  not null default 0
);

create table public.flashcard_state (
  card_id         uuid primary key references public.flashcards(id) on delete cascade,
  stage           int  not null default 1 check (stage between 1 and 3),
  next_review_on  date not null default current_date,
  cleared_at      timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- Row level security: members only, everywhere
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'domains', 'skills', 'practice_tests', 'skill_results',
    'error_log', 'error_reviews', 'questions', 'drill_sessions', 'question_attempts',
    'tutor_threads', 'tutor_messages', 'flashcards', 'flashcard_state'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "members only" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())',
      t
    );
  end loop;
end $$;

-- Reference data is read-only for the app.
drop policy "members only" on public.domains;
drop policy "members only" on public.skills;
create policy "members read" on public.domains for select to authenticated using (public.is_member());
create policy "members read" on public.skills  for select to authenticated using (public.is_member());

alter table public.app_users enable row level security;
create policy "members read" on public.app_users for select to authenticated using (public.is_member());

-- Usage rows are only written through consume_ai_call(); members may read their own.
alter table public.ai_usage enable row level security;
create policy "own usage" on public.ai_usage for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Storage: private bucket for error-log screenshots
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "members manage screenshots" on storage.objects
  for all to authenticated
  using (bucket_id = 'screenshots' and public.is_member())
  with check (bucket_id = 'screenshots' and public.is_member());
