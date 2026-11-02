-- Passcode mode: no Supabase Auth accounts. The app's server talks to the database with
-- the secret key (which bypasses RLS) and records everything under one fixed student id.
-- RLS stays on, so the public (publishable) key still can't read or write any table.

do $$
declare t text;
begin
  foreach t in array array['practice_tests', 'error_log', 'drill_sessions', 'question_attempts', 'tutor_threads'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_created_by_fkey');
    execute format('alter table public.%I alter column created_by set default %L::uuid', t, '00000000-0000-0000-0000-0000000a1ee0');
  end loop;
end $$;

alter table public.ai_usage drop constraint if exists ai_usage_user_id_fkey;

-- Daily Claude budget, now keyed by the id the server passes in. Server (secret key) only.
drop function if exists public.consume_ai_call(date, int);
create or replace function public.consume_ai_call(p_user uuid, p_day date, p_limit int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  used int;
begin
  insert into public.ai_usage (user_id, day, calls)
  values (p_user, p_day, 1)
  on conflict (user_id, day) do update set calls = ai_usage.calls + 1
  where ai_usage.calls < p_limit
  returning calls into used;
  return used is not null;
end;
$$;
revoke all on function public.consume_ai_call(uuid, date, int) from public, anon, authenticated;
grant execute on function public.consume_ai_call(uuid, date, int) to service_role;
