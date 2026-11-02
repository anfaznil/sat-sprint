# SAT Sprint

A private, phone-first SAT prep app for one student, Aleena, for the digital SAT on **Saturday, Dec 5, 2026**. Registration closes **Nov 20**.

Stack: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · Supabase (Postgres, magic-link auth, Storage) · Anthropic Claude API (server routes only) · Vercel.

## Build status

| # | Feature | Status |
|---|---------|--------|
| 1 | Skill map, Bluebook results entry, weakest → strongest dashboard | ✅ |
| 2 | Error log with 1 → 3 → 7 day spaced review, charts | ✅ |
| 3 | Daily 30-min drill with Claude-generated questions, streak | ✅ |
| 4 | "Why was I wrong?" AI tutor + follow-up chat | ✅ |
| 5 | Countdown + weekly plan | ✅ |
| 6 | Grammar flashcards, Desmos tips | ✅ |

---

## Setup

### 1. Create the Supabase project (free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor:** run these files in order, pasting each one in:
   1. `supabase/migrations/0001_schema.sql`: all tables, RLS, the rate-limit function, and the screenshots bucket
   2. `supabase/migrations/0002_seed_skills.sql`: College Board domains and skills
   3. `supabase/migrations/0003_drill_planned.sql`: daily drill size
   4. `supabase/migrations/0004_tutor_and_light_days.sql`: tutor message storage, light review days
   5. `supabase/migrations/0005_seed_flashcards.sql`: grammar flashcards
   6. The allowlist: copy `supabase/allowlist.example.sql` to `supabase/allowlist.sql` (git-ignored), put in the two real emails, and run it.

   If you use the Supabase CLI instead, run `supabase link` and then `supabase db push`. The allowlist still has to be run by hand.

3. **Authentication → URL Configuration**
   - Site URL: your production URL, e.g. `https://sat-sprint.vercel.app`
   - Redirect URLs: add `http://localhost:3000/**` and `https://<your-vercel-domain>/**`

4. **Authentication → Emails → Templates:** set both the **Magic Link** and **Confirm signup** templates to:

   ```html
   <h2>Sign in to SAT Sprint</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Tap here to sign in</a></p>
   <p>Or type this code in the app: <strong>{{ .Token }}</strong></p>
   ```

   The `token_hash` link works even when the email opens in a different browser than the one that asked for it, which happens a lot with phone mail apps. The code is the fallback for when the link opens somewhere awkward, like inside the Gmail app.

5. **Optional, after both of you have signed in once:** turn off **Authentication → Sign In / Providers → Allow new users to sign up**. Access is already locked down without this step: the login page only sends links to allowlisted emails, and RLS hides every row from anyone not in `app_users`.

> Supabase's built-in email sender is rate-limited to a few emails per hour. That's plenty for two people. If it ever becomes a problem, a custom SMTP provider fixes it, but that's an extra service, so ask first.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same page. The publishable key (`sb_publishable_…`) or the legacy `anon` key both work. |
| `ANTHROPIC_API_KEY` | console.anthropic.com. Needed from feature 3 on. Server-only. |
| `AI_DAILY_LIMIT` | Max Claude calls per user per day (default 40) |
| `APP_TIMEZONE` | Aleena's IANA time zone, e.g. `America/New_York`. Makes "today" roll over at her midnight, not at UTC midnight. |

Never put the Supabase **secret/service-role** key in this app. It doesn't need it.

### 3. Run locally

```bash
npm test
```

runs the checks for the pure logic (spaced review, drill planning, grading, question validation).


```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000, enter an allowlisted email, and use the link or the code.

### 4. Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (framework preset: Next.js).
2. Add the same environment variables under Project → Settings → Environment Variables.
3. Deploy, then put the production URL into Supabase's Site URL and Redirect URLs (step 1.3).
4. On her phone: open the site → Share → **Add to Home Screen** for an app-like icon.

---

## How it works

### Access control
- `app_users` is the allowlist. `public.is_member()` checks the signed-in user's email against it.
- Every table has RLS with `using (is_member())`. Data is shared between members, so the coach sees Aleena's progress.
- `src/proxy.ts` refreshes the session and sends signed-out visitors to `/login`.
- `src/lib/auth.ts` (`requireMember`) is the data access layer that every page and server action calls.

### Skill ranking (feature 1)
For each skill, accuracy = correct ÷ total over the **3 most recent tests** that include it, so older tests fade out as she improves. Skills are sorted weakest first. Ties go to the domain worth more questions on test day. Skills with no data are listed separately.

### Spaced review (features 2 and 6)
`stage` 1 is due 1 day after logging, stage 2 is due 3 days after a correct review, and stage 3 is due 7 days later. A correct answer at stage 3 clears the item. A miss at any stage resets it to stage 1, due tomorrow.

In the error log, a review asks her to re-solve the question, tap **Show answer**, and grade herself honestly (**Got it right** / **Missed it**). The rules live in `src/lib/spaced.ts`. Reviews are recorded only for items that are due, so a double tap can't skip a stage.

### Screenshots
Phone screenshots are shrunk in the browser (max 1600px JPEG) and uploaded straight to the private `screenshots` bucket, because server actions cap request bodies at 1 MB. Pages show them through signed URLs that expire after an hour. Deleting an error also deletes its screenshot.

### Daily drill (feature 3)
1. **Reviews first.** Everything due in the error log, using the same review screen.
2. **New questions next.** 8–15 of them (fewer on heavy review days), rotating through her **3 weakest skills**. If fewer than 3 skills have test data, it fills in untested skills from the biggest domains, alternating sections.
3. **Difficulty adapts.** It starts from her test accuracy on the skill (under 50%: easy, under 75%: medium, otherwise hard). Then her last few drill answers on that skill move it up or down a level.
4. **Questions are reused.** Stored questions she hasn't answered are served first. When a skill and difficulty runs out, Claude writes 3 more in one call. Each one is checked (4 distinct choices, a valid answer key, a passage for R&W, no LaTeX, sane lengths) and saved to `questions`. Invalid ones are discarded.
5. **Answers are graded on the server.** The browser never gets the answer key before she answers. Typed math answers accept equivalent forms (7/2 = 3.5).
6. **Misses go to the error log.** A wrong answer offers one-tap "why did you miss it?" buttons that add it to the error log.
7. **Streak.** Consecutive days with a finished drill.

The next question is fetched through a route handler (`/api/drill/next`) rather than a server action, so it can be written in the background while she works on the current one. Server actions run one at a time and would block her answer.

**Model and cost:** `claude-opus-5-5` at medium effort, with structured JSON output, and `fallbacks: "default"` so a rare safety decline is retried on another model. Expect roughly $0.05–0.15 per generation call. A full drill with no reusable questions is about 5 calls, so well under $1 a day, and less as the question bank grows.

### "Why was I wrong?" tutor (feature 4)
The button appears on every error-log item (the detail page and the review screen) and under every drill answer ("Explain it more" when she got it right).
- **Context sent:** the question (and its screenshot, if any), her answer, the correct answer, and her reason tag (error log) or the answer key's explanation (drill).
- **Tutor prompt:** a patient SAT tutor that explains step by step, names the trap, gives one tip for next time, and stays under 200 words.
- **Streaming:** the reply streams in as it's written.
- **Follow-ups:** up to 6, each answered in under 120 words.
- **Saved:** one thread per item per person, so reopening shows the old conversation instead of paying for a new one.

Each assistant reply's raw content blocks are stored in `tutor_messages.blocks` and replayed verbatim on follow-ups. The conversation is append-only, which current Claude models require when replaying their thinking. It also keeps the prompt cache warm. As a safety net, requests set `block_binding.prefix_mismatch_behavior: "drop_block"`, so a mismatch drops stale reasoning instead of failing. Every message counts toward the daily AI limit.

### Countdown plan (feature 5)
`/plan` lists every day from this week through Dec 5:
- **Saturdays:** a full Bluebook practice test.
- **Other days:** the daily drill. The Sunday after a practice test reminds her to log the misses first.
- **Dec 3–4:** light review only. The drill serves due reviews and no new questions.
- **Test day:** a checklist.

Past days show ✓ when done. The Nov 20 registration reminder shows on Home and on the plan until the deadline. A logged Saturday practice test counts toward the streak, just like a finished drill.

### Grammar cards and Desmos tips (feature 6)
- **Grammar cards** (`/flashcards`): 25 original cards on commas, semicolons, colons, transitions, and subject-verb agreement, using the same 1 → 3 → 7 day review. Due cards come first, plus up to 6 new ones a session. There's progress per topic and a "browse all rules" list for light days.
- **Desmos tips** (`/desmos`): short how-tos for solving equations by graphing, intersections, parabola features, regressions, statistics, sliders, testing answer choices, and inequalities.

### Claude cost control
`consume_ai_call(day, limit)` atomically increments `ai_usage` and returns `false` once the daily limit is reached. Server routes call it before every Claude request.

## Project structure

```
supabase/
  migrations/0001_schema.sql      tables, RLS, rate limit fn, storage bucket
  migrations/0002_seed_skills.sql domains + skills
  migrations/0003–0005            drill size, tutor storage + light days, flashcards
  allowlist.example.sql
src/
  proxy.ts                        session refresh + signed-out redirect
  lib/
    env.ts  dates.ts  auth.ts     config, Dec 5 / Nov 20 dates, requireMember()
    skills.ts                     ranking logic (pure, no I/O)
    supabase/{server,proxy}.ts    Supabase clients
    spaced.ts                     1 → 3 → 7 day review rules (pure)
    errors.ts                     miss reasons, ErrorItem type
    supabase/client.ts            browser client (screenshot uploads only)
    ai/claude.ts                  Anthropic client, model, per-day rate limit
    tutor/context.ts              tutor system prompt + question context
    plan.ts                       day types (drill / practice / light / test), weekly plan
    flashcards.ts                 card topics
    drill/                        generate (Claude), validate, plan, streak, next question
    logic.check.ts                npm test
    data/skills.ts                skill map + results queries
    data/errors.ts                error log queries, signed screenshot URLs
    data/drill.ts                 today's session, focus skills, streak
  components/                     bottom-nav, tutor-panel, bar-list (charts), flash, confirm-button
  app/
    login/                        magic link + 6-digit code
    auth/confirm, auth/signout    route handlers
    (app)/page.tsx                dashboard
    (app)/tests/                  test list, new-test form, server actions
    (app)/errors/                 log + charts, new, [id] detail, review session, actions
    (app)/drill/                  drill runner, question player, answer/log actions
    api/drill/next/route.ts       next question (generates if needed)
    api/tutor/{thread,message}    open a tutor thread; stream a reply
    (app)/plan, flashcards, desmos, more
```
