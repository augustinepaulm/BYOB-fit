# BYOB-fit: Claude Design brief (v2.0, Sep 27, 2026)

Supersedes nothing yet: v1.0 (`docs/DESIGN-BRIEF.md`, md5 f216f6b548bad5894bbdc974259a6889) stays the contract for the shipped seven screens until the v2 decisions are frozen in `docs/DECISIONS.md`. This brief is for exploring and finalizing the end-state UX.

How to use it:
1. If the Claude Design project that produced `design/BYOB-fit_Design.html` still exists, continue in it so the visual language carries over. Otherwise start a new project and paste everything below the line.
2. Work in the four rounds below, in order. Approve a round before starting the next. Do not ask for pixel polish until round 4.
3. Placeholder data only (section 6). Nothing personal: no real program, biometrics, goals, or names. The export gets committed to the public repo.
4. When all rounds are approved: Export → Hand off to Claude Code. Bring the bundle back to the decisions chat before any executor prompt is written.

---

## 1. What this is

BYOB-fit (Build Your Own Body) is an open-source workout app that runs as a home-screen web app on a phone. It shows the day's session as a grouped checklist, runs it as a deck of exercise tiles with per-set logging, keeps a meal log against a calorie target, and can ask an AI model (the user's own API key) to revise the program from what was logged. All data is stored on the phone. There is no server and no account.

The shipped app has seven screens (Today, Deck, Week, Log, Meals, Profile, Settings) designed in v1. This brief extends it from a one-person app to an app a stranger can pick up, including someone new to training and not comfortable with technology.

Target: phone, 390 × 844 portrait. Light and dark mode. Engineering target React + Vite, mobile-first PWA, IndexedDB, no backend.

## 2. Who it is for

Design every new flow so all four of these can finish it without help:

| | Comfortable with tech | Not comfortable with tech |
|---|---|---|
| Trains regularly | Imports a program file or builds one fast; sets up AI in a minute | Builds their known program with forms; may never turn on AI |
| New to training | Starts from a template; wants to understand each movement | Needs a starter program, visual demos, plain words, and a guided AI setup they can skip |

Rule of thumb: every screen must make sense to the bottom-right person, without slowing down the top-left person.

## 3. Design direction

Keep the v1 direction as the baseline: clean surfaces, generous whitespace, big numerals, one accent color, hairline dividers, rounded cards, calm not gamified. No gradients, glow, confetti, or mascots. One sans-serif family, sentence case, no exclamation marks.

Gym-use constraints (unchanged): 44 px minimum touch targets; weight and reps readable at arm's length; the active set row sits in the top half because the keyboard covers the bottom half.

Aesthetic check (round 1 only): render the Today screen twice, once in the v1 direction and once in one alternative direction of your choosing (state it in one line). The owner picks one; all later rounds use the pick. Do not produce more than two directions.

Navigation: at most five bottom tabs. Proposed: Today, Week, Log, Meals, Profile. Program editing and privacy settings are reached from Profile or Week, not new tabs. If you think a different tab set works better, show it once in round 1 with a one-line reason.

## 4. Rounds and screens

### Round 1: aesthetics, onboarding, goals

**1a. Aesthetic check** (see section 3).

**1b. Onboarding wizard** (first run only; every step skippable except the first two; progress dots at top; Back always available):
1. Welcome: what the app does in two sentences; "Your data stays on this phone."
2. Two questions that branch the rest: "Do you already follow a workout program?" (Yes / No) and "How new are you to training?" (New / 1 to 3 years / 3+ years).
3. Readiness check for everyone: a short yes/no health readiness screen with a clear "talk to a professional first" outcome if any answer is yes. The app still lets them continue.
4. Program source, branched:
   - Already follows a program: "Build it with forms" or "Import a program file" (the file option is visibly secondary).
   - Does not: pick a starter template (3-day, 4-day, 5-day full body or split); each card shows days per week, session length, and level.
5. Goal setter (1c).
6. Units: kg or lb.
7. AI features (optional, skippable): what they do, what they cost (paid by the user's own Anthropic account), a plain-language 3-step key setup, and the privacy level choice (4d). "Skip, I'll do this later" is as prominent as "Set up".
8. Done: lands on Today.

**1c. Goal setter** (also reachable later from Profile). Structured, never free text:
- Goal type (pick one primary, up to two secondary): lose weight, lose body fat, build muscle, get stronger, improve cardio, general fitness.
- Target as a relative change with a unit: "lose 10 lb", "minus 2% body fat", "run 5 km without stopping".
- Timeframe: 4, 8, 12, or 16 weeks.
- Ranked priorities: drag to order the chosen goals.
- A summary card: "Your goal: lose 10 lb in 12 weeks, then build muscle."
- Current stats (weight, body fat) are optional, stored on the phone, and marked with a small lock icon and "Never sent to AI unless you allow it".

### Round 2: building and changing the program

**2a. Program builder.** One set of screens with two entry points:
- "Start a new program": from a template or blank.
- "Edit current program": opens the active program.

Flow: Program settings (name, weeks, start date) → Day list (seven days, rest days, reorder, mark days as swappable) → Day editor (sections: warm-up, main, abs, cardio, cooldown, daily; add, reorder, remove) → Item editor (exercise picker with search and a demo thumbnail; type: weight and reps, bodyweight reps, timed hold, distance, cardio minutes, check-off; sets, rep range, rest, tempo, optional per-side) → Validate and save.

Rules the design must show:
- Removing an item that has logged history shows "Retire this exercise? Your history is kept." Retired items disappear from future days but stay in the Log. There is no hard delete for items with history.
- Validation errors appear inline on the field that caused them, not as a list at the end.
- Unsaved changes survive leaving the screen; show a "Draft" badge until saved.

**2b. AI review of a new or edited program.** Reached by a button, never automatically. A banner on Today or Week suggests it once a program and a goal both exist ("Want an AI review of your program against your goal?"), dismissible.
- Before sending: the payload preview (2d).
- Result: a list of proposed changes, each with a one-line reason and its own Accept and Reject. Nothing applies until the user taps "Apply accepted changes". Show a count ("3 of 5 accepted").

**2c. Weekly update, anytime.** On Week: "Update program" offers two choices, "Edit it myself" (opens 2a on the current program) or "Ask AI" (uses what has been logged so far, against the goal).
- AI result: the whole proposal as one diff grouped by day, additions and changes highlighted, each with a reason; Approve all or Discard. (Deliberately different from 2b, which is line by line.)
- Mid-week: the proposal states which days it affects ("Applies from Thursday").
- States: loading, error ("Couldn't reach the model. Check your key in Settings"), no key ("Set up AI to use this").

**2d. Payload preview (shared by every AI call).** A sheet that opens before any request is sent:
- Title: "This will be sent to Anthropic under your key".
- The exact fields grouped as they will be sent (for example: 12 exercises, 38 sets logged, goal: lose 10 lb in 12 weeks).
- The current privacy level with a "Change" link.
- Buttons: Send, Cancel.

### Round 3: the daily loop

**3a. Deck** (extends v1):
- Visual demo slot on every exercise tile: a media frame (looping clip or image sequence placeholder, clearly marked "demo") plus the existing text how-to underneath. The media is stored in the app; design no loading from outside sites. Collapsed by default with one tap to expand; for users who chose "New" in onboarding, expanded by default on first use of each exercise.
- Dictation hint on the set input: a small microphone hint the first few times ("Tap the mic on your keyboard and say 62.5 for 8").
- Progression suggestion: when a local rule suggests a change, a small chip on the pre-filled row ("Try 65, you hit 4 × 8 last week"). Tapping fills it in. Never auto-applied.
- "Something felt off" control per exercise: options "Too easy", "Too hard", "Discomfort, skipped". Stored on the phone.

**3b. Log: week against week.** On an exercise's detail: a comparison view with two week pickers (defaults: the latest week and the one before). Side-by-side sets (weight × reps per set), best set per week, and the change. The existing history table and sparkline stay.

**3c. Week: future weeks.** A week picker to view any upcoming week of the program, labeled "As planned today" because updates can change it. Days in future weeks are read-only unless opened in the builder.

**3d. Meals: local-first with a calorie target.**
- Target card: daily calorie and protein target against the goal, with "Calculated on this phone" under it. If the goal and timeframe would push the target below a safe floor, show the floor instead and one line explaining why.
- Day entry (v1 convention). After tapping Parse: lines that match the user's own baseline are parsed on the phone and marked "on phone". Lines that do not match are listed as "Needs AI" with a Send button that opens the payload preview (2d) showing only those lines, and a "Enter kcal myself" alternative.
- Day and week totals against the target.

### Round 4: settings, privacy, polish

**4a. Settings** (extends v1): units; privacy level (4d); API key with setup guide link and a "Set a spend limit in your Anthropic account" tip; model name; export with a warning ("This file contains your health data. Keep it somewhere private."); monthly "Back up your data" reminder toggle; import; reset.

**4b. Sent log.** A list of every AI call: date, type (review, weekly update, meals), and the fields sent. Read-only.

**4c. Privacy page.** Plain language, one screen: what is stored, where, what is sent and when, that the app's maintainer receives nothing, and that sent data is handled under the user's own Anthropic account and Anthropic's terms (link, no restated policy).

**4d. Privacy levels.** Used in onboarding step 7, Settings, and the payload preview:

| Sent to AI | Minimal (default) | Standard | Full |
|---|---|---|---|
| Exercises, sets, weights, reps, dates; program structure | Yes | Yes | Yes |
| Structured goal (type, relative target, timeframe) | Yes | Yes | Yes |
| Training rules text the user wrote | Yes | Yes | Yes |
| Experience level; "felt off" flags | No | Yes | Yes |
| Age range, sex, current weight | No | No | Yes |
| Free-text session notes | No | No | Opt-in |
| Name, date of birth, body stats history | Never | Never | Never |

Onboarding for users who chose "New to training" shows a one-line suggestion to pick Standard ("Helps the AI avoid pushing exercises that caused discomfort"), but does not pre-select it.

**4e. Polish pass** across all rounds: empty, loading and error states; dark mode; the 44 px rule; copy consistency.

## 5. Out of scope for this design

Accounts, sign-in, social features, notifications other than the in-app backup reminder, syncing with health apps or wearables, a prescribed meal plan, a marketplace, and in-app voice recording (voice stays with the keyboard's dictation).

## 6. Placeholder data (use only this)

Reuse the v1 placeholder data for the Push day, its exercises and last-week numbers, and the seven-day week view (see `docs/DESIGN-BRIEF.md` section "Placeholder data"). Additional placeholders for new screens:
- Goal: primary "Lose weight: lose 10 lb in 12 weeks"; secondary "Get stronger".
- Starter templates: "3-day full body (beginner, 45 min)", "4-day upper/lower (intermediate, 60 min)", "5-day split (experienced, 75 min)".
- Calorie card: target 2,000 kcal and 140 g protein; day so far 1,450 kcal and 96 g protein.
- Meals lines: "BASE breakfast", "BASE lunch", "ADD protein bar 1" (matched), "Dinner at a friend's, pasta" (needs AI).
- AI review proposals (2b): "Bench press: 4 × 6 to 8 → 3 × 6 to 8 (recovery for a new lifter)", "Add: goblet squat 3 × 10 on Wednesday (legs trained once a week)", "Cable fly: rest 90 s → 60 s (goal: time-efficient sessions)".
- Sent log: three rows dated in the current month.

## 7. Deliverable

All four rounds approved, in one project. Then Export → Hand off to Claude Code with a README stating: React + Vite, mobile-first PWA, IndexedDB for storage, no backend, placeholder data only, and that decisions shown are drafts pending the project's decision records.
