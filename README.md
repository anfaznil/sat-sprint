# SAT Sprint

A private, phone-first SAT prep app for one student, Aleena, for the digital SAT on **Saturday, Dec 5, 2026**. Registration closes **Nov 20**.

Stack: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · Supabase (Postgres, Storage) · Anthropic Claude API (server routes only) · Vercel.

## Build status

| # | Feature | Status |
|---|---------|--------|
| 1 | Skill map, Bluebook results entry, weakest → strongest dashboard | ✅ |
| 2 | Error log with 1 → 3 → 7 day spaced review, charts | ✅ |
| 3 | Daily timed SAT module (M1 → adaptive M2) from a hand-written bank, streak | ✅ |
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
   8. `supabase/migrations/0008_untagged_misses.sql`: lets drill misses save before they're tagged
   9. `supabase/migrations/0009_flashcard_quiz.sql`: 75 SAT-style grammar questions
   10. `supabase/migrations/0010_timed_modules.sql`: timed SAT modules
   11. `supabase/migrations/0011_question_bank.sql`: 162 hand-written Reading and Writing questions

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
| `ANTHROPIC_API_KEY` | console.anthropic.com. Server only. Used only by the tutor. |
| `AI_DAILY_LIMIT` | Max tutor messages per day for the whole app (default 40) |
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

### Daily timed module (feature 3)
The daily session is **one real-format digital SAT module**: a few minutes of error-log reviews (untimed), then the module.

| | Reading and Writing | Math |
|---|---|---|
| Questions / time | 27 in 32 minutes | 22 in 35 minutes |
| Order | Grouped by type in SAT order: Words in Context → Text Structure → Cross-Text → Central Ideas → Evidence (textual, quantitative) → Inferences → Boundaries → Form/Structure/Sense → Transitions → Rhetorical Synthesis, easier to harder within each type | All four domains mixed (Algebra 7, Advanced Math 7, Problem-Solving & Data 4, Geometry & Trig 4), easier to harder overall; weaker skills get more of the domain's questions |

**Adaptive like the SAT.** Module 1 has a balanced mix (9 easy / 9 medium / 9 hard for R&W). The next session is Module 2: the **harder** version (mostly hard) if Module 1 was at least 70% right, otherwise the **easier** version. After a Module 2, the next session starts a new Module 1. It follows the test focus setting; with both sections in focus, it alternates sections after each pair. (`src/lib/modules/blueprint.ts`, tested by `npm test`.)

**The timed screen** (`/module/[id]`) is full-screen like Bluebook:
- **Timer:** a countdown you can hide, with a 5-minute warning.
- **Tools:** Mark for Review and an answer eliminator on every question.
- **Moving around:** a "Question N of 27" navigator, Back/Next, and a Check Your Work page before submitting.
- **Server-side deadline:** it's stored on the server, so reloading or leaving doesn't pause it. When time runs out the module submits itself, and coming back after the deadline grades what was answered.
- **No early peeking:** answer keys never reach the phone before the module is submitted.

**Questions: no API cost.** Modules are filled from a hand-written bank, so nothing is generated at runtime and modules start instantly. The bank has 162 Reading and Writing questions (54 easy, 54 medium, 54 hard), enough for about 6 full modules. A question she has seen is never reused. A slot takes an exact skill and difficulty match first, then the closest difficulty for that skill. If a skill runs out, or for Math (no Math questions yet), the module's cover page says more questions are needed.

To add questions, edit or add a JSON file in `scripts/question-bank/`, then build a **new** migration containing only the new file (the build checks structure, duplicates and passage lengths, and balances answer letters):

```bash
python3 scripts/question-bank/build.py supabase/migrations/0012_more_questions.sql scripts/question-bank/new-file.json
```

Difficulty is the question writer's judgment, based on real SAT patterns. It isn't calibrated against College Board data. Bluebook and the SAT Suite Question Bank remain the official benchmarks.

**Results** (`/modules/[id]`):
- **Summary:** the score, time used, and average seconds per question against SAT pace (71s R&W, 95s Math).
- **Pacing chart:** time on each question, colored right/wrong/blank, with a pace line and time sinks called out.
- **Accuracy by question type.**
- **Full review:** every question with the explanation and the tutor.
- **Misses:** saved to the error log automatically. Blank answers are tagged "timing".

Submitting a module completes the day for the streak. `/modules` lists every module with its score. Saturdays stay full Bluebook practice tests (official, adaptive), and Dec 3–4 are reviews only.

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

### Look and feel
- **App icon:** `src/app/icon.svg` (browser tab) and PNGs for the Home Screen (`src/app/apple-icon.png`, `public/icons/`), plus `src/app/manifest.ts`, so "Add to Home Screen" opens full-screen. To change the icon, edit and run `npx tsx --tsconfig tsconfig.json scripts/make-icons.tsx`.
- **Icons:** Lucide line icons, drawn through `components/ico.tsx` and `icon-tile.tsx`.
- **Section colors:** Reading & Writing is teal and Math is blue (`--rw` / `--math` in `globals.css`, `SectionTag`). They're kept separate from the good/warn/bad status colors.
- **Question screen:** reads like Bluebook. Passages use a serif (Source Serif 4), and choices use lettered bubbles.
- **Feedback:** a pop on a right answer, a shake on a wrong one, and a short vibration on Android. Finishing the drill brings confetti and the XP bar filling up, with a level-up badge when it crosses a level. All of the motion is skipped when the device asks for reduced motion.
- **Tips while loading:** grammar, Desmos and strategy tips (`src/lib/tips.ts`) rotate while a fresh question is being written.

### XP and levels
XP is computed from data the app already stores (`src/lib/xp.ts`, `src/lib/data/xp.ts`), so there's nothing extra to save or keep in sync:

| Action | XP |
|---|---|
| Right drill answer / wrong drill answer | +10 / +3 |
| Right review / wrong review | +8 / +3 |
| Finished daily drill | +25 |
| Miss logged by hand | +5 |
| Practice test logged | +50 |
| Grammar card started / mastered | +2 / +10 |

Level 1 → 2 takes 100 XP, and each level after takes 50 more than the last. The bar is on Home, and the drill's done screen shows "+XP" for that sitting.

### Test focus (superscoring)
**More → Test focus** picks **Both sections**, **Reading & Writing**, or **Math** for the current test date. It's stored in `app_settings.focus_section`. With one section chosen:
- **Drill:** the drill's 3 weakest skills and its due reviews come only from that section.
- **Home:** the review count and skill ranking show only that section, with a "Focusing on…" banner.
- **The other section:** its error-log items stay scheduled and visible in the error log. They come back into drills when the focus switches back.

If migration 0007 hasn't been run, the app treats the focus as "both" and the picker explains what's missing.

### Grammar cards and Desmos tips (feature 6)
- **Grammar cards** (`/flashcards`): 25 rules on commas, semicolons, colons, transitions, and subject-verb agreement, tested like the SAT. Each rule has 3 original questions (`flashcard_questions`): a sentence with a blank and 4 choices, where the blank covers the words the choices start with. She taps an answer, it's graded on the server, and the rule appears as the explanation. Each review of a rule shows its next question, so the sentence is new each time. Right or wrong drives the same 1 → 3 → 7 day schedule, and a rule she gets right the first time starts at the 3-day step. Answer positions are balanced across A–D. Due rules come first, plus up to 6 new ones a session, with progress per topic and a "Study the rules" list for light days.
- **Desmos tips** (`/desmos`): short how-tos for solving equations by graphing, intersections, parabola features, regressions, statistics, sliders, testing answer choices, and inequalities.

### Claude cost control
`consume_ai_call(student_id, day, limit)` (callable only with the secret key) atomically increments `ai_usage` and returns `false` once the daily limit is reached. Server routes call it before every Claude request.

## Project structure

```
supabase/
  migrations/0001_schema.sql      tables, RLS, rate limit fn, storage bucket
  migrations/0002_seed_skills.sql domains + skills
  migrations/0003–0011            drill size, tutor storage + light days, flashcards,
                                  passcode mode, test focus, untagged misses, grammar quiz,
                                  timed modules, question bank
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
    drill/                        answer grading, streak
    logic.check.ts                npm test
    data/skills.ts                skill map + results queries
    data/errors.ts                error log queries, signed screenshot URLs
    data/drill.ts                 today's session, focus skills, streak
    data/settings.ts              test focus (both / R&W / Math)
    data/xp.ts  xp.ts             XP totals and levels
  components/                     bottom-nav, tutor-panel, bar-list (charts), flash, confirm-button
  app/
    login/                        passcode form
    auth/signout                  lock this device
    (app)/page.tsx                dashboard
    (app)/tests/                  test list, new-test form, server actions
    (app)/errors/                 log + charts, new, [id] detail, review session, actions
    (app)/drill/                  drill runner, question player, answer/log actions
    api/module/prepare/route.ts   re-checks the bank for an unfilled module
    api/tutor/{thread,message}    open a tutor thread; stream a reply
    (app)/plan, flashcards, desmos, more
```
