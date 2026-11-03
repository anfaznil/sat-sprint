-- App-wide settings (one row). focus_section lets the student concentrate on one half
-- of the SAT for a test date (superscore strategy): drills and Home follow it.
create table public.app_settings (
  id             int primary key default 1 check (id = 1),
  focus_section  text not null default 'both' check (focus_section in ('both', 'rw', 'math')),
  updated_at     timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict do nothing;

alter table public.app_settings enable row level security;
create policy "members only" on public.app_settings for all to authenticated
  using (public.is_member()) with check (public.is_member());
