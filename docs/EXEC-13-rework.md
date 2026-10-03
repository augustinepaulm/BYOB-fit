# EXEC-13-rework: Phase 13, the v3 rework (v1.0, Oct 3, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly, touch only what they name, and add no runtime dependencies (dev-only tools for checks are allowed outside `src/`). The visual source of truth is `design/BYOB-fit_v3_design.html`: build to it, do not restyle or improve it, and where this prompt or D-083 to D-086 differ from it, they win. Do not touch any Dependabot pull request or branch; nothing under `.github/` changes. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". After task 2, read `docs/DECISIONS.md` D-031, D-044, D-046, D-047, D-048, D-053, D-055, D-064, D-066, D-069, D-070 to D-072, D-075 and D-077 to D-086, `docs/SCORES.md` and `design/BYOB-fit_v3_README.md`.

Nine commits after the contracts commit, each passing `npm run verify`, `npm run lint` and the full test suite on its own (B to J below). This is long: you may stop after any commit, push, and report. Open the pull request as a draft at the first push (task 18's command); it stays a draft throughout.

Working directory: `~/Code/BYOB-fit`.

## Reading the canvas

The canvas is a self-unpacking bundle. Its markup is the JSON string inside `<script type="__bundler/template">`; its assets (fonts, scripts) are base64 entries in the JSON of `<script type="__bundler/manifest">`, gzipped when `compressed` is true. Write a throwaway script outside `src/` that decodes the template to a readable HTML file and extracts the assets; do not commit it or its output. Frames carry `data-screen-label` ("2.04 Load and reps, rest running", "Dark 2.04 ..."). Copy text exactly as drawn, except where D-083 or D-084 change it.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase-13`. `git log --oneline -1` must show `974ddbf`; STOP if not. Write `docs/EXEC-13-rework.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` f5e5cbee0341e05c26184e27deee4d1e, `docs/DECISIONS.md` 13d5248ad3721ef3a92eea5316aae83a, `docs/EXEC-11.9.md` 9c51381d240becd7f4c3318b5d05d81c; STOP if any differ. `npx vitest run` reports 450 tests.

2. Place by hash from `~/Downloads` (older downloads of the same names exist; identify by md5, not name): `docs/PLAN.md` 08579e2d91197fa415f8faccc4495c91, `docs/DECISIONS.md` ae2efdac7a686790e0d49aa0a5b86fd8, `docs/SCORES.md` 58305c1c8d40a2f0d5d8648124268cb3, `docs/DESIGN-BRIEF-v3.md` 7692e52739a4562552691cb95d01141e, `design/BYOB-fit_v3_design.html` 810513dd6e85976aab00112b50350bca, and the file with md5 f6d6af7ea22521841cf8f40883f80174 (downloaded as `README.md`) as `design/BYOB-fit_v3_README.md`. Re-hash all six; STOP if any differs. Commit A with `docs/EXEC-13-rework.md`: `Contracts: plan v1.26, D-077 to D-086, scores, brief v3, design v3, EXEC-13-rework`.

### Commit B: foundation (D-077, D-083, D-086)

3. Fonts and tokens.
   a. From the canvas manifest, write these woff2 files to `public/fonts/` and check each md5: `bricolage-grotesque-latin.woff2` (asset ae22d68c-78ea-499e-ac58-8191cef23ef7) ecbeb05e3a924379abb5f460b33818ca; `bricolage-grotesque-latin-ext.woff2` (bb157b99-e3fe-4260-9825-20b9dde6c0c1) f29f8d3317d4f4e1a4f8544dda33b859; `atkinson-hyperlegible-400-latin.woff2` (1089c181-5c2f-41d0-acc2-5f086071c052) d444e1815a3a7248ddfd59e5dd00b431; `atkinson-hyperlegible-400-latin-ext.woff2` (f1637c0d-1976-4b37-ad3a-06da2179e5f4) bedd1a793e822eccd00a8503aa6e686f; `atkinson-hyperlegible-700-latin.woff2` (73ef9f78-735e-433c-88f4-50ce99bb5a56) c6b471cbb2b98ff523c57ff9b9f1eeb6; `atkinson-hyperlegible-700-latin-ext.woff2` (c5a0b7bc-ed03-48c9-99a4-1e94937a6313) c23ae1f7f70862fa97b79519c81bd6b2. Add the licences as `public/fonts/OFL-Bricolage-Grotesque.txt` (https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt, md5 ca124d9da1494f1d3c650b05144c8ceb) and `public/fonts/OFL-Atkinson-Hyperlegible.txt` (same path under `atkinsonhyperlegible`, md5 d7370c968457d6a437c72ef772f25ee9). `@font-face` rules with the canvas's unicode ranges; Bricolage declared as a variable font (weight 400 to 800, width 75 to 100). The service worker precaches the fonts. The D-066 policy is unchanged and must still hold (`font-src 'self'`).
   b. Replace the colour tokens in `src/index.css` with the v3 README's light and dark sets (Appearance System, Light and Dark keep working, D-039; `theme-color` follows). Add the type scale, radii and shadows from the README. Muted (#8a847a) only for non-essential text (D-083 rule 4).

4. Components and shell, matching the canvas: primary, secondary, tertiary and destructive buttons, chip, field, segmented control, sheet, dialog, progress ring, list row; the fixed header (brand row with the wordmark, then the context row); the navy tab bar (80 px including the safe area) with five tabs, Train, Meals, Body, Progress, Profile; the sage in-progress bar (60 px, above the tab bar on other tabs: workout name, rest timer if running, Return). The tab bar hides while a text or number field has focus.

5. Routing (D-077, D-083 rule 6). Train: `/` Today and `/week` Week, switched by a segmented control. `/deck` moves inside the tabbed layout. Meals `/meals`. Body `/body`, `/body/new`, `/body/history`. Progress `/progress/training`, `/progress/nutrition`, `/progress/body`, with exercise history at `/progress/training/:exerciseId`; `/log` and `/log/:exerciseId` redirect there. Profile `/profile`; `/settings` and its sub-pages, `/goal` and `/review` show the tab bar with Profile active. Onboarding, import and the builder stay full-screen without the tab bar. Body and Progress may show placeholder empty states until their commits.

6. Leaving the deck (D-077 rule 4): the rest timer's end time and typed, unsaved set boxes for the open session persist (in `meta`, keyed by session) and are restored when the deck reopens, including after the app is closed and reopened. The in-progress bar appears on other tabs while the session is open.

7. D-086: when a session would end with no confirmed set and no checked item, it is deleted instead (add the database helper). This applies to the four summary paths (`useSession.end`), `finish`, a mid-workout Change and `endOpenSession`. The summary then reads "Nothing was logged" and Done returns to Today.

8. Tests and commit B: font files by md5 and the `@font-face` sources are local; tab routes and the `/log` redirects; deck state persists across unmount and remount; the tab bar hides on field focus; D-086 on each path, and a session with one set still ends normally. Commit: `Phase 13 B: foundation, fonts, tokens, five tabs, deck state (D-077, D-083, D-086)`.

### Commit C: data (PLAN v1.26 section 5)

9. Database version 5 and export envelope version 4 exactly as PLAN section 5's v1.26 storage rules say. Upgrade from version 4 keeps every existing record unchanged. The import reads versions 1 to 4. Tests: an upgrade from a version 4 database written by `main`'s code (seeded in the test) keeps programs, sessions, meals, day changes, goals and the sent log byte-identical; export then import of a version 4 envelope round-trips body entries and notes; a version 3 file still imports. Commit: `Phase 13 C: database version 5, export version 4`.

### Commit D: usage, budget and privacy (D-084, D-085)

10. a. `readResponseText` (or a sibling) also returns `usage`; `sendAndLog` stores `model` and `usage` on the sent-log entry. b. `src/lib/usage.ts` (pure): this month's tokens and estimated cost per model from the sent log, the price table and the budget state (under, warn, over). c. Every AI action (review, update, meals estimate, week review) checks the budget before opening the send preview: over with the switch on blocks with the message; warn and over with the switch off show a notice and continue. d. Settings: frame 3.16 (with D-084 rule 1's names and copy) and frame 3.17 (usage this month, monthly budget, stop switch, warn percentage, recent sends with cost, the price table editable, the console limits link, the dedicated-key advice). Onboarding 1k's Full line: "Adds current weight". e. D-084 rule 2 in the payload builder: body entries at every level; week score and parts in week reviews. Tests: usage read from a reply; cost for a known reply (Sonnet 5: 12,000 in and 1,500 out = $0.024 + $0.015 = $0.039); a model with no price row; month boundary; warn at 80%; block when over with the switch on, notice with it off; payload contents per level including body entries; nothing at any level carries height, age, sex or the key. Commit: `Phase 13 D: AI usage, budget and privacy levels (D-084, D-085)`.

### Commit E: Body (D-078)

11. Frames 3.06, 3.07, 3.08 and 4.03. Every field optional; one entry per date, a new one for the same date replaces it after a confirmation; units by D-078 rule 2; latest values with the change since the previous entry; history with edit and delete. BMR: `computeTargets` takes the body entries and uses an entered BMR no more than 8 weeks old as resting energy (D-078 rule 3); Meals says which source the target used. Tests: one-field entry; replace on the same date; change since previous; BMR within and beyond 8 weeks; the TARGETS worked example unchanged without a BMR. Commit: `Phase 13 E: Body (D-078)`.

### Commit F: Meals (D-079)

12. Frames 3.01 to 3.05, 4.06 and 4.10. The meal system prompt and `validateParsedMeal` add `carbsG`, `fatG`, `fibreG`, `sodiumMg`, `addedSugarG` and `satFatG` per item and as day totals (differences may be negative, as for kcal now). Baseline foods take the same optional fields and count on the phone. Lines can be labelled Breakfast, Lunch, Dinner or Snack. Targets and limits exactly as SCORES.md Part 4; AI-supplied values carry the "AI estimate" tag. The input is a friendly list as drawn, not a monospace box; the existing line grammar (D-049) still parses. Tests: SCORES.md Part 4's worked examples (fibre 38 g at 2,720 kcal; saturated fat 11.3% over the limit); added sugars per labelled meal only; validation of each new field; a baseline food's fields counted without AI. Commit: `Phase 13 F: Meals nutrients, targets and limits (D-079)`.

### Commit G: scores and Progress (D-080)

13. a. `src/lib/scores.ts` (pure) implements SCORES.md Parts 1 to 5 exactly, with tests that reproduce every worked example: training 76 (build muscle) and 85 (lose body fat); nutrition 71 and 85 (missing data); body 75; the noise-band rules; an empty ended session not counted; a Discomfort skip left out of completeness; below the floor never in range. b. Frames 2.18, 3.09, 3.10, 3.12, 3.14 and 4.02: each view with its score ring, trend, parts in words, "How this is worked out", missing data named. Charts as inline SVG (no library): Training, estimated one-rep max per lift (D-071 rule 2) and weekly working sets per muscle group (exercises without muscles listed as "not tagged") and an adherence calendar; Nutrition, daily calories against the band and protein and fibre against targets with limits as reference lines; Body, weight with a 7-day average, muscle and fat mass together, each tape measurement. c. The Log's exercise list, history, index-lift view and set editing move under Progress > Training unchanged in behaviour. Lose weight shows trends only (SCORES.md Part 5, OPEN band). Commit: `Phase 13 G: scores and Progress (D-080)`.

### Commit H: week notes (D-081)

14. Frames 3.11, 3.13 and 4.04. "Review this week" on each Progress view, behind the budget check and the send preview, kind `week_note`, stored in `weekNotes` with the week, view and reply, newest first. System prompt, word for word: "You review one week of a person's training, nutrition or body data from a workout app. Write three to five plain sentences: what moved, what held, and one thing to watch next week. Use only the data given; do not recalculate the score. No medical advice, no exclamation marks." Tests: payload per level; a stored note per week and view; the budget block applies. Commit: `Phase 13 H: AI notes on a week (D-081)`.

### Commit I: Train restyled (D-083 rules 1 and 2)

15. Frames 2.01 to 2.17 and 4.09 and their dark versions: Today (before, in progress, done), the deck for every tile type, the Plan sheet, the End dialog, the session summary, Week (current, future, earlier with every state), day detail, the Change sheet. Swap per D-083 rule 1 (today only, the D-069 rule 8 prescription fields). Summary per D-083 rule 2 (no Use or Keep weight buttons). Motion per the README with its reduce-motion versions. The active set row stays above the screen midline with the keyboard open. Every existing behaviour of Phases 10A to 12 and small changes 11.1 to 11.9 is kept. Commit: `Phase 13 I: Train in the v3 design`.

### Commit J: everything else restyled

16. Onboarding 1a to 1l (with "Restore from a backup" on 1a, D-072 rule 1, running the same import as Settings), Profile 3.15, the states 4.01, 4.05, 4.07 and 4.08, and D-083 rule 3's screens restyled without layout changes. Commit: `Phase 13 J: onboarding, Profile, Settings and states in the v3 design`.

## Checks and report

17. After commit J, scripted in WebKit and Chromium at 390 × 844 under the D-066 policy, with evidence in the report:
   a. `npm run verify` passes with the task 2 md5s; `npm audit` reports 0; the test count is above 450, with the number per commit.
   b. No request leaves the page except to `api.anthropic.com`; fonts load from the app (network log); no policy violation in the console on any route.
   c. Every frame id of the canvas has a matching screenshot of the build, light and dark, under `phase13-screens/` named by frame id, plus side-by-side images (canvas left, build right) for 2.04, 2.12, 2.13, 3.03, 3.06, 3.09 and 3.17. List every visible difference you did not resolve.
   d. Upgrade: data written by `main`'s build (974ddbf) opened by this build keeps every Week day, every Log entry and the program, and exports as version 4.
   e. The gate flows in PLAN Phase 13's gate line, scripted.
   f. Regression: the 11.7 End dialog by touch; 11.8 checks b, e and g; 11.9 checks b, d and f; Phase 12 checks c and f.
   g. `git diff --stat main`: nothing under `.github/` or `seed/`.

18. Push `phase-13` and open the pull request **as a draft**: `gh pr create --draft --title "Phase 13: the v3 rework"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence and per-commit hashes, then Judgment calls, then anything noticed but not changed.
