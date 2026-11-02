-- Copy to allowlist.sql (git-ignored), put in the real emails, and run it in the
-- Supabase SQL editor. Only these emails can sign in or see any data.
insert into public.app_users (email, display_name, role) values
  ('aleena@example.com', 'Aleena', 'student'),
  ('you@example.com',    'Coach',  'coach')
on conflict (email) do update
  set display_name = excluded.display_name, role = excluded.role;
