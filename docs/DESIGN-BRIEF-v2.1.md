# BYOB-fit: Claude Design brief v2.1 (Sep 27, 2026), remaining screens

Continues brief v2.0 (`DESIGN-BRIEF-v2.md`, md5 de3ff85f61214a2b812b8a5922d60967) and the approved v2 canvas (`BYOB-fit_v2_dc.html`, md5 970e7c399055df0f6ac95d092a02a732). Where this brief and v2.0 differ, this brief wins.

How to use it:
1. Best: continue in the same Claude Design project that produced the v2 canvas, and paste everything below the line. If that project is gone, start a new one, attach `BYOB-fit_v2_dc.html` as the visual reference, and paste the same text.
2. Work the rounds in order and approve each before the next.
3. Placeholder data only (section 7). Nothing personal. The export is committed to a public repo.
4. When done, export (Claude Code handoff format if offered) and save it with a new name: `BYOB-fit_v2-1_design.html`. Do not reuse an earlier filename; a reused name already caused the wrong file to be uploaded once.

---

## 1. What is already approved (do not redesign)

- Direction **1b "ink and paper"**, now for the whole app.
- Onboarding steps 1 to 8 (frames 1c to 1o), except step 3 (see section 3).
- Goal setter from Profile (1p).
- Builder: starter template path, template day editor, swap picker, exercise detail with demo slot, forms path steps 1 to 4, item editor with inline validation, retire dialog (2a to 2j).
- Bottom tabs: Today, Week, Log, Meals, Profile. Settings is reached from Profile.

## 2. Design tokens for 1b (taken from the approved Today frame)

| Role | Value |
|---|---|
| Paper background | #f5f2ec |
| Ink, primary text | #1b1a17 |
| Secondary text | #5f5a50 |
| Muted text | #8f897d |
| Hairline dividers | #ddd5c8 |
| Accent (one only) | #1f3a5f deep navy |

Open lists on hairlines instead of cards; heavier headline type; hero numerals large (about 52 px on Today). Keep 44 px minimum touch targets, sentence case, no exclamation marks, and the active set row in the top half of the screen. Dark mode is not yet defined for 1b: define it in round 4 as a derived palette (warm near-black ground, same single accent lightened for contrast) and apply it to every screen.

## 3. Changes since v2.0

- **Onboarding step 3** is no longer a questionnaire. It is one notice screen with this exact text, no Skip, one button:

  > **Before you start**
  >
  > BYOB-fit is not medical advice. Check with a doctor or physiotherapist before starting a new training program if you have a heart, lung, bone or joint condition, take medicine for your heart or blood pressure, are pregnant, are recovering from an injury or surgery, or have felt chest pain, dizziness or faintness during exercise.
  >
  > During any workout, stop if you feel chest pain, severe breathlessness, dizziness or sharp pain.
  >
  > [ I understand, continue ]

  Design this one frame in round 4. Frames 1e and 1f are retired. Do not change the wording.
- **Privacy levels** keep the labels already designed in 1n: Minimal (default), Standard, Full. Every AI feature uses the payload preview (2d below) before sending.
- **All screens in 1b.** Today, Deck, Week, Log, Meals, Profile and Settings still exist in the v1 look; rounds 3 and 4 below redraw them in 1b.

## 4. Round 2 (rest): AI flows

**2k. Suggestion banner.** On Today and Week, once a program and a goal both exist: "Want an AI review of your program against your goal?" with Review and Dismiss. Dismissed banners do not return for that program. If no key is set, the Review button leads to the AI setup (same screens as onboarding 1m and 1n).

**2l. AI review result (per line).** A list of proposed changes, each showing what changes (before → after), a one-line reason, and its own Accept and Reject. A counter ("3 of 5 accepted") and a primary "Apply accepted changes" button, disabled until at least one is accepted. Nothing applies before that tap. States: loading, error ("Couldn't reach the model. Check your key in Settings"), no changes proposed ("No changes suggested for your goal").

**2m. Update program (from Week).** A sheet with two choices: "Edit it myself" (opens the builder on the current program) and "Ask AI" (uses what has been logged so far, against the goal).

**2n. AI update result (whole patch).** One diff grouped by day: additions, changes and removals, each with a reason. A line stating which days it affects ("Applies from Thursday" mid-week, or "Applies from next week"). Two buttons only: Approve all, Discard. Show visually that this differs from 2l: no per-line controls.

**2o. Payload preview sheet** (used by 2l, 2n and Meals). Title "This will be sent to Anthropic under your key". The exact contents grouped as sent, for example: "Program: 6 training days, 42 exercises", "Logged: 38 sets from 4 sessions", "Goal: lose 10 lb in 12 weeks, then get stronger". The current privacy level with a Change link. Send and Cancel. Show one variant at Minimal and one at Standard (Standard adds "Experience level: new" and "2 'felt off' notes").

## 5. Round 3: the daily loop, in 1b

**3a. Deck.** Redraw all v1 deck states in 1b (load and reps, bodyweight reps, timed hold, per side, cardio, check-off, flagged row, rest timer running, session summary), then add:
- Demo slot on every exercise tile: a placeholder frame marked "demo", collapsed by default, one tap to expand; text how-to stays underneath. For a user who chose "New", show it expanded the first time each exercise appears.
- Dictation hint on the set input for the first few uses: "Tap the mic on your keyboard and say 62.5 for 8".
- Progression chip on a pre-filled row: "Try 62.5, you hit 4 × 8 last week". Tapping fills it in. Never applied on its own.
- "Felt off" control per exercise with three options: Too easy, Too hard, Discomfort (skipped).
- Swap on the tile opens the approved swap picker (2c).

**3b. Log, week against week.** On an exercise's detail: two week pickers (defaults: latest week and the one before), sets side by side as weight × reps, best set for each week, and the change between them. The existing history table and sparkline stay below, redrawn in 1b. Also redraw the exercise list with search.

**3c. Week.** Redraw in 1b (seven day cards, done states, swap picker), plus:
- A week picker to view any future week, labeled "As planned today".
- Future days are read-only; an "Edit in builder" link opens the builder.
- The "Update program" entry (2m) replaces v1's "Build next week" card.

**3d. Meals.**
- Target card: daily calories and protein against the goal, with "Calculated on this phone" underneath. A floor state: when the goal would push the target too low, show the floor value and one line: "Set to a safe minimum for your goal and timeframe."
- Day entry in the v1 line convention. After Parse: lines that match the user's baseline are marked "On phone" with their numbers. Unmatched lines are grouped under "Needs AI" with two choices: "Send these lines" (opens 2o showing only those lines) or "Enter kcal myself" (inline fields).
- Day and week totals against the target.

## 6. Round 4: settings, privacy, polish

**4a. Profile** in 1b: goal summary card (opens the approved goal setter), program card (name, week N of M, "Edit program" into the builder), current stats (optional, lock icon, "Stored on this phone"), gear to Settings.

**4b. Settings** in 1b: units; privacy level; AI key with Test, setup guide link, and the tip "Set a spend limit in your Anthropic account"; model name; Sent log; Privacy; Safety notice; Export with the warning "This file contains your health data. Keep it somewhere private."; monthly backup reminder toggle; Import; Reset (with confirmation).

**4c. Sent log.** Read-only list of AI calls: date, type (Review, Update, Meals), privacy level used, and a tap-to-expand list of exactly what was sent.

**4d. Privacy page.** One scrolling screen in plain language: what is stored and where (this phone only); what is sent and when (only when you tap Send, only what the preview shows); that the app's maintainer receives nothing; that sent data is handled under your own Anthropic account and Anthropic's terms (a link, no restated policy); how to export and how to delete everything.

**4e. Safety notice.** Onboarding step 3 (section 3) plus the same text reachable from Settings.

**4f. Polish pass.** Empty, loading and error states for every screen; the 1b dark palette applied everywhere; the 44 px rule; copy consistency; the offline state ("You're offline. Logging works; AI features need a connection").

## 7. Placeholder data

Reuse brief v1.0's Push day, exercises and seven-day week, and brief v2.0 section 6 (goal, templates, calorie card, meal lines, AI review proposals). Round 3 and 4 screens show loads in kg to match the v1 session; this is placeholder data, not a units decision. Additional placeholders:
- Week against week, barbell bench press: previous week 60 × 8, 60 × 8, 60 × 7, 57.5 × 8; latest week 62.5 × 8, 62.5 × 8, 62.5 × 7, 60 × 8.
- AI update diff (2n), Thursday onward: "Lateral raise 4 × 12 to 15 → 4 × 15 to 20 (hit the top of the range every set)"; "Remove push-ups from warm-up (duplicate of main work)"; "Add face pull 3 × 15 to Push (shoulder balance)".
- Sent log: three rows this month: Review (Minimal), Update (Minimal), Meals (Standard, 1 line).
- Offline banner and one error state per AI screen.

## 8. Out of scope

Accounts, sign-in, social features, push notifications (the in-app backup reminder is the only reminder), health-app or wearable sync, meal plans, in-app voice recording, and any change to the approved frames listed in section 1.

## 9. Deliverable

One project with all rounds approved, exported with a README stating: React + Vite, mobile-first PWA, IndexedDB, no backend, placeholder data only, visual direction 1b with the tokens in section 2, and that decisions shown are drafts pending the project's decision records. File name `BYOB-fit_v2-1_design.html`.
