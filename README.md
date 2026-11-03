# SAT Sprint

A private, phone-first SAT prep app for one student, Aleena, for the digital SAT on **Saturday, Dec 5, 2026**. Registration closes **Nov 20**.

Stack: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · Supabase (Postgres, Storage) · Anthropic Claude API (server routes only) · Vercel.

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
2. **SQL Editor → New query:** for each file below, in order, open it, copy its **contents**, paste them into the editor, and click **Run**. Each one should say "Success. No rows returned." Run each file once.
   1. `supabase/migrations/0001_schema.sql`: all tables, RLS, the rate-limit function, and the screenshots bucket
   2. `supabase/migrations/0002_seed_skills.sql`: College Board domains and skills
   3. `supabase/migrations/0003_drill_planned.sql`: daily drill size
   4. `supabase/migrations/0004_tutor_and_light_days.sql`: tutor message storage, light review days
   5. `supabase/migrations/0005_seed_flashcards.sql`: grammar flashcards
   6. `supabase/migrations/0006_passcode_mode.sql`: passcode access (no Supabase accounts)
   7. `supabase/migrations/0007_section_focus.sql`: the "test focus" setting

   With the Supabase CLI instead: `supabase link`, then `supabase db push`.

To check it worked, open **Table Editor**: `skills` should have 30 rows and `flashcards` 25.

No email setup is needed. The app doesn't use Supabase Auth, magic links, or SMTP.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same page: the publishable key (`sb_publishable_…`) or the legacy `anon` key. Safe in the browser: RLS blocks it from every table. It's only used to upload screenshots to one-time signed URLs. |
| `SUPABASE_SECRET_KEY` | Same page: the **secret** key (`sb_secret_…`) or the legacy `service_role` key. **Server only. Never share it or put it in client code.** |
| `APP_PASSCODE` | You choose it. What Aleena types once per device. A few words (e.g. `purple otter 2026`) beat a short PIN. |
| `SESSION_SECRET` | A random string of 32+ characters: `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | console.anthropic.com. Server only. |
| `AI_DAILY_LIMIT` | Max Claude calls per day for the whole app (default 40) |
| `APP_TIMEZONE` | Aleena's IANA time zone, e.g. `America/New_York`. Makes "today" roll over at her midnight, not at UTC midnight. |
| `STUDENT_NAME` | Name on the home screen (default `Aleena`) |

### 3. Run locally

```bash
npm install
```

```bash
npm test
```

runs the checks for the pure logic (spaced review, drill planning, grading, question validation, passcode sessions).

```bash
npm run dev
```

Open http://localhost:3000 and enter the passcode.

### 4. Deploy to Vercel

1. Import the GitHub repo in Vercel (framework preset: Next.js).
2. Before the first deploy, add every variable from step 2 under **Environment Variables**.
3. Deploy. Every push to `main` redeploys automatically.
4. On her phone: open the site, enter the passcode, then Share → **Add to Home Screen** for an app-like icon.

To change the passcode, update `APP_PASSCODE` in Vercel and redeploy. That signs out every device.

---

## How it works

### Access control (passcode mode)
- **No accounts.** Entering `APP_PASSCODE` on `/login` sets a signed, httpOnly cookie that's valid for a year (`src/lib/session.ts`, HMAC-SHA256 via Web Crypto). A wrong guess waits 1.5 s. The signing key includes the passcode, so changing the passcode signs out every device.
- **The proxy** (`src/proxy.ts`) checks the cookie on every request. It sends locked visitors to `/login`, and API calls get a 401.
- **Database access.** The server uses the Supabase **secret** key, and `src/lib/auth.ts` (`requireMember`) is the data access layer every page, action and API route calls first. All rows are stored under one fixed student id (`STUDENT_ID`), so anyone with the passcode, including the coach, sees the same progress.
- **The browser can't touch the database.** RLS is still on for every table, and the browser's publishable key can't read or write any of them. Screenshot uploads use a one-time signed upload URL from the server.
- **Leftovers.** The `app_users` table and `is_member()` from the original email-login design are unused now. They're harmless, and they're kept in case email sign-in comes back.

### Skill ranking (feature 1)
For each skill, accuracy = correct ÷ total over the **3 most recent tests** that include it, so older tests fade out as she improves. Skills are sorted weakest first. Ties go to the domain worth more questions on test day. Skills with no data are listed separately.

### Spaced review (features 2 and 6)
`stage` 1 is due 1 day after logging, stage 2 is due 3 days after a correct review, and stage 3 is due 7 days later. A correct answer at stage 3 clears the item. A miss at any stage resets it to stage 1, due tomorrow.

In the error log, a review asks her to re-solve the question, tap **Show answer**, and grade herself honestly (**Got it right** / **Missed it**). The rules live in `src/lib/spaced.ts`. Reviews are recorded only for items that are due, so a double tap can't skip a stage.

### Screenshots
Phone screenshots are shrunk in the browser (max 1600px JPEG) and uploaded straight to the private `screenshots` bucket through a one-time signed upload URL from the server, because server actions cap request bodies at 1 MB. Pages show them through signed URLs that expire after an hour. Deleting an error also deletes its screenshot.

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

### Test focus (superscoring)
**More → Test focus** picks **Both sections**, **Reading & Writing**, or **Math** for the current test date. It's stored in `app_settings.focus_section`. With one section chosen:
- **Drill:** the drill's 3 weakest skills and its due reviews come only from that section.
- **Home:** the review count and skill ranking show only that section, with a "Focusing on…" banner.
- **The other section:** its error-log items stay scheduled and visible in the error log. They come back into drills when the focus switches back.

If migration 0007 hasn't been run, the app treats the focus as "both" and the picker explains what's missing.

### Grammar cards and Desmos tips (feature 6)
- **Grammar cards** (`/flashcards`): 25 original cards on commas, semicolons, colons, transitions, and subject-verb agreement, using the same 1 → 3 → 7 day review. Due cards come first, plus up to 6 new ones a session. There's progress per topic and a "browse all rules" list for light days.
- **Desmos tips** (`/desmos`): short how-tos for solving equations by graphing, intersections, parabola features, regressions, statistics, sliders, testing answer choices, and inequalities.

### Claude cost control
`consume_ai_call(student_id, day, limit)` (callable only with the secret key) atomically increments `ai_usage` and returns `false` once the daily limit is reached. Server routes call it before every Claude request.

## Project structure

```
supabase/
  migrations/0001_schema.sql      tables, RLS, rate limit fn, storage bucket
  migrations/0002_seed_skills.sql domains + skills
  migrations/0003–0007            drill size, tutor storage + light days, flashcards,
                                  passcode mode, test focus
src/
  proxy.ts                        passcode check on every request
  lib/
    env.ts  dates.ts  auth.ts     config, Dec 5 / Nov 20 dates, requireMember()
    skills.ts                     ranking logic (pure, no I/O)
    session.ts                    signed passcode cookie
    supabase/{server,client}.ts   secret-key server client; browser client for uploads
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
    data/settings.ts              test focus (both / R&W / Math)
  components/                     bottom-nav, tutor-panel, bar-list (charts), flash, confirm-button
  app/
    login/                        passcode form
    auth/signout                  lock this device
    (app)/page.tsx                dashboard
    (app)/tests/                  test list, new-test form, server actions
    (app)/errors/                 log + charts, new, [id] detail, review session, actions
    (app)/drill/                  drill runner, question player, answer/log actions
    api/drill/next/route.ts       next question (generates if needed)
    api/tutor/{thread,message}    open a tutor thread; stream a reply
    (app)/plan, flashcards, desmos, more
```
