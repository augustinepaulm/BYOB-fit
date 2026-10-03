# BYOB-fit: Governing plan

BYOB = Build Your Own Body (STATED, Sep 12, 2026). Repo and app name: BYOB-fit.

Version: 1.26 · Date: Saturday, Oct 3, 2026 (v1.25 Oct 3, v1.24 Oct 2, v1.23 Oct 2, v1.22 Oct 2, v1.21 Oct 1, v1.20 Oct 1, v1.19 Sep 30, v1.18 Sep 30, v1.17 Sep 30, v1.16 Sep 29, v1.15 Sep 29, v1.14 Sep 28, v1.13 Sep 28, v1.12 Sep 28, v1.11 Sep 28, v1.10 Sep 28, v1.9 Sep 28, v1.8 Sep 28, v1.7 Sep 28, v1.6 Sep 28, v1.5 Sep 27, v1.4 Sep 14, v1.3 Sep 13, v1.2 Sep 12) · Owner: Auggie · Chat pipeline: this Claude chat (decisions) · Execution pipeline: Claude Code in VS Code (implementation)

Provenance convention throughout: STATED (Auggie) · VERIFIED (checked in chat, with source) · MODELED (Claude's estimate, method shown) · DEFAULT (Claude's proposal pending redirect).

## 1. Purpose and scope

An open-source, home-screen workout app that: shows the day's session as a grouped checklist; runs it as a deck of exercise tiles with per-set logging, last-week targets and visual demos; accepts typed or dictated entries; keeps a meal log against a calorie target calculated on the phone; holds structured goals; lets the user build or edit a program in the app; and, when the user asks, has a model the user supplies a key for review the program or propose an update, showing exactly what will be sent first. All data stays on the phone except what the user sends through that preview.

v1.5 scope change (D-036): other people may use the app, including people new to training and not comfortable with technology. Built to be picked up without editing JSON. Promotion to strangers waits on O-7.

Out of scope: accounts, a server, app stores, meal plans, health-app or wearable sync, in-app microphone, social features. See DECISIONS.md D-019 to D-021.

Success test for v1 (STATED goal, MODELED test): Auggie logs a full week of v10 sessions in the app on his phone, with no paper or FitDay fallback, and the weekly reprogramming call returns a proposal he would act on. Met or not, it stays the v1 record.

Success test for v2 (MODELED): a person who has never seen the app installs it, completes onboarding with a starter program, logs two weeks without help, and never edits a file.

## 2. Decisions in force

All decisions live in DECISIONS.md (checksummed in section 8). Summary of the frozen set: PWA · React + Vite + IndexedDB · GitHub Pages, public repo, personal data via gitignored import · direct browser call to Anthropic with BYO key · claude-sonnet-5 default · three model jobs, each behind a send preview and privacy level (D-006 as amended, D-031) · weekly update as a whole patch (D-025), AI review line by line on request (D-026), update at any time (D-027) · builder with retire-not-delete (D-028) · onboarding with a safety notice (D-029) · structured goals (D-030) · local-first meals with an on-phone calorie target (D-032) · bundled visual demos (D-033) · visual direction 1b, light and dark (D-034) · program schema v2 (D-035) with closed byWeek overrides (D-038) · three approved full-gym starter programs (D-037) · other users in scope (D-036) · keyboard dictation plus parser · Sunday week · sections not flat lists · set boxes and the iOS keyboard (D-054) · add a set and add an exercise during a session, today only unless kept (D-055, D-056) · edit logged sets, in the session and from Log (D-057) · Week day detail and builder fixes (D-059) · the user controls the routine (D-061) · swap any two days and replace a day, in any week (D-062) · today's plan in the deck with reorder (D-063) · set boxes on the device (D-064) · plan sheet and Add set build rules (D-065, default) · security hardening (D-066) · navy tab bar, dependable End, quieter Dependabot (D-067) · swap scope and exercise swap prescription (D-068) · change a day, add and change exercises, edit from Log (D-069) · AI spending limit and usage (D-070) · progress graphs and body log (D-071) · Phase 12 follow-ups (D-072) · how-to guide (D-073) · bug fixes from Oct 2 device use (D-074) · finished dates and ending a session (D-075) · how-to guide built last (D-076) · five tabs, always shown (D-077) · body log fields and BMR (D-078) · more nutrients, fibre target and limits (D-079) · training, nutrition and body scores (D-080) · AI notes on a period (D-081) · design rework method (D-082) · design v3 adopted with corrections (D-083) · privacy levels kept, body data and scores sent (D-084) · AI usage and budget as built (D-085) · an empty ended session is discarded (D-086).

## 3. Inputs (private, never committed)

| Input | Provenance | Where it lives |
|---|---|---|
| Training program v11 (muscle-preservation block) | STATED, pasted into chat Sep 13, 2026; supersedes the v10 handoff of Sep 12 (the FitDay fork still carries v10) | Converted to `seed/program.json`, gitignored; imported on first run. Hash recorded in chat only, since the file is private. Week 1 starts Sunday Aug 9, 2026, so Sunday Sep 13 begins week 6 (v11 counts the block Mon Sep 14 to Sun Oct 25; app weeks start Sunday). Corrected Sep 13 after the first import showed week 5 |
| Exercise descriptions | To be written per item; STATED where Auggie supplies, DEFAULT where Claude drafts | Inside the seed program file |
| Profile and goal fields | STATED by Auggie at first run, typed into the app | IndexedDB only |
| Anthropic API key | Auggie's own | IndexedDB only, entered in Settings |

The pasted v11 document also carries measured, stated and modeled health context. None of it enters the repo, the plan, or any committed file. The app stores only what Auggie types into Profile.

## 4. Screens

Source of truth for layout and copy: `design/BYOB-fit_v2_design.dc.html` (frame ids below) until Phase 13 lands; from Phase 13, `design/BYOB-fit_v3_design.html` (D-083) with the five tabs of D-077. Tabs: Today, Week, Log, Meals, Profile.

| Area | Frames | Model call |
|---|---|---|
| Onboarding, 8 steps | 1a to 1l | No (step 7 only stores a key and tests it) |
| Builder: template path, swap picker, exercise detail, forms path, retire | 2a to 2j | No |
| Today · Deck (all tile types and states) · session summary | 3a to 3g | No |
| Log list and week-against-week detail | 3h, 3i | No |
| Week current and future, read-only future day, swap days | 3j to 3m | No |
| Meals: target, local parse, Needs AI, floor, manual entry | 3n to 3p | Only for unmatched lines, after the preview |
| AI: suggestion banner, review, update sheet, update result, states, send preview | 4a to 4i | Yes, each after the preview |
| Goal setter, Profile, Settings, privacy level, reset, export, sent log, privacy page, safety notice | 5a to 5j | Key test only |
| Empty, loading, error and offline states | 7a to 7e | n/a |
| Dark mode for every frame above | `<id>-dark` | n/a |

The v1 screens in `design/BYOB-fit_Design.html` stay in force for each screen until the phase that rebuilds it.

## 5. Data model (FROZEN at Gate 2, Sep 13, 2026; byWeek wording re-frozen Sep 14, D-023; schema v2 and new stores frozen Sep 27, D-035; byWeek overrides closed Sep 28, D-038)

The machine-readable contract is `docs/program.schema.json` (JSON Schema 2020-12). The import screen validates every program file against it; a file that fails does not load. Summary:

```
Program   { schemaVersion: 1 | 2, id, name, version, weekStartsOn: "sunday", programWeeks, startDate,
            notes, exercises: { [id]: Exercise }, days: Day[7] }
Exercise  { name, howTo, tags[], muscles?[], equipment?, level?, demo? }        (v2 fields optional)
Day       { id, order (0 = Sunday), name, focus, durationMin, swappableWith?, rest?, sections: Section[] }
Section   { id, kind: warmup|main|block|abs|cardio|cooldown|daily, title, items: Item[] }
Item      { id, exerciseId, type: load_reps|bodyweight_reps|timed_hold|distance|cardio_block|check,
            perSide?, sets?, repMin?, repMax?, holdSec?, distanceM?, minutes?, tempo?, restSec?, rpe?,
            unit?: kg|lb, index?, logged?, cue?, notes?, alternateExerciseId?, byWeek?: { [week]: partial Item },
            retiredFrom? (v2, date; not an overridable field) }
```

Rules frozen with it:
- `currentWeek` = floor((today − startDate) / 7 days) + 1, clamped to 1..programWeeks. Derived, not stored. `startDate` must be a Sunday; import rejects any other weekday.
- `byWeek` keys are program week numbers. Overrides are cumulative (D-023): for week W, apply every override with key <= W in ascending order on top of the base item, later keys overwriting earlier ones field by field. Any Item field may be overridden, including `exerciseId` (staged progressions such as plyo stages).
- `logged` default by section kind: main, block and abs log per set; cardio logs minutes plus a note; warmup, cooldown and daily are check-off. `logged: true|false` on an item overrides that.
- `unit` is shown as entered, no conversion. `index: true` marks the monitored lifts; the Log screen has an index-lift view and the reprogramming prompt carries the ">5% down on two or more index lifts over two weeks" rule.
- `alternateExerciseId` renders a one-tap substitute on the tile; the session records which exercise was actually done.
- Warm-up ramps and rotations are ordinary `check` items with a `cue`.

Stores outside the program file (unchanged from v1.2):

```
Session   { id, date, dayId, programWeek, startedAt, endedAt, swapped, entries: Entry[] }
Entry     { itemId, exerciseId (as performed), sets: SetLog[], checked, note, feltOff?: easy|hard|discomfort (D-048), skipped? (set by Discomfort, Phase 10A) }
SetLog    { n, side?: L|R, weight, reps, seconds, distanceM, minutes, rpe, raw }
Profile   { fields: { [label]: value }, updatedAt }
MealDay   { date, lines[], parsed?: { kcal, proteinG, items: [{ line, kcal, proteinG, source?: phone|ai|manual }] }, parsedAt }   (a missing source means ai, D-049)
Settings  { apiKey, model, lastExportAt, rules, mealBaseline, mealFoods?: [{ name, kcal, proteinG? }] (D-049), storagePersisted, storageEstimate,
            units: kg|lb, privacyLevel: minimal|standard|full (default minimal),
            onboarding?: { completedAt?, followsProgram?, experience?: new|experienced, safetyAckAt? },
            reviewBannerDismissedFor?: programId[] }
Goals     { items: [{ rank, type: lose_weight|lose_fat|build_muscle|get_stronger|improve_cardio|general,
            target?: { amount, unit: lb|kg|percent|km|min, exerciseId? } }], timeframeWeeks: 4|8|12|16,
            startDate, currentStats?: { weight?, weightUnit?, bodyFatPct?, heightCm?, age?, sex?: male|female, activity?: sitting|active|very_active (D-046) }, updatedAt }
SentLog   { id, at, kind: review|update|meals, privacyLevel, payloadSummary, payload, status?: sent|failed, error? }   (Phase 9; status D-050)
```

v1.5 storage rules: IndexedDB version 3 adds `goals` (one record, key `me`) and `sentLog` (keyPath `id`, index `at`), and rewrites every stored program's `schemaVersion` to 2 on upgrade. Export envelope version 2 adds `goals` and `sentLog`; import reads versions 1 and 2 (version 1 files restore with empty goals and sent log); any other version is refused. `currentStats` and the API key never leave the phone except that `currentStats` is included in the user's own export file.

v1.26 storage rules (Phase 13): IndexedDB version 5 adds `bodyEntries` (keyPath `date`; D-078 fields) and `weekNotes` (keyPath `id`, index `weekStart`; D-081). Meal lines and baseline foods gain optional `carbsG`, `fatG`, `fibreG`, `sodiumMg`, `addedSugarG`, `satFatG`; a meal day gains `lineMeals` (one entry per line: breakfast, lunch, dinner, snack or null). Sent-log entries gain `model`, `usage` { inputTokens, outputTokens } and the kind `week_note`. Settings gain `prices` and `budget` { monthlyUsd?, warnPct, stopAtBudget }. The open deck's state (rest end time, unsaved boxes) is kept in `meta`. Export envelope version 4 adds `bodyEntries` and `weekNotes`; versions 1 to 4 import; the API key is never exported (unchanged).

Parser grammar (D-011): `<number> (for|x|by|×) <number>` → weight, reps · `<number> (s|sec|seconds)` → seconds · `<number> (m|meters|metres)` → distance · `<number> (min|minutes)` → minutes · `same` → copy last week's set · `bodyweight` or `bw` → weight 0 · spoken numbers ("twenty two point five") normalised before matching. Unparseable input stays in `raw`, row flagged, never silently zeroed.

Seed and sample (unchanged in v1.5): `seed/program.json` is v11, 7 days, 222 items, 115 exercises, 5 index lifts, 2 alternates, 10 items with `byWeek`, drafted how-to text per exercise, gitignored. `public/sample-program.json` is a generic 3-day program, 41 items, 24 exercises, committed for forks.

## 6. Phases and numbered tasks

Each phase ends at a gate: Claude Code reports PASS/FAIL per task number; this chat verifies independently from GitHub; Auggie approves. Production deploy (GitHub Pages) happens only when Auggie merges the phase branch into `main` (D-024); the executor never merges.

### Phase 0: Setup (gate: hello page live on GitHub Pages)
0.1 Confirm Node, npm, git versions on Auggie's Mac
0.2 Install Claude Code for VS Code; sign in
0.3 Create GitHub repo `BYOB-fit` (public), clone locally
0.4 Scaffold Vite + React; add `.gitignore` entry for `seed/program.json`
0.5 Add GitHub Pages deploy workflow; deploy the scaffold; verify served bytes match local build
0.6 Commit PLAN.md and DECISIONS.md into `docs/`; verify md5 against section 8

### Phase 1: Design (gate: handoff bundle downloaded)
1.1 Claude Design prompt for Today, Deck, Week, Log, Meals, Profile, Settings: docs/DESIGN-BRIEF.md (placeholder data only, since the handoff bundle is committed to the public repo)
1.2 Iterate until Auggie approves each screen
1.3 Export → Hand off to Claude Code; bundle stored under `design/` in the repo

### Phase 2: Data and import (gate: Today shows v10 Sunday from the seed file)
2.1 `seed/program.json` from v11: delivered Sep 13, validated against the schema; Auggie reviews the how-to text and the unit defaults (dumbbell, cable and machine loads defaulted to lb, kettlebell and goblet work to kg), then places the file by hand
2.2 IndexedDB schema and repository layer for all entities in section 5
2.3 Import screen: load seed JSON, validate, activate
2.4 Today and Week screens from the handoff bundle, reading real data
2.5 `public/sample-program.json` (delivered Sep 13, validated) committed for forks; `docs/program.schema.json` committed as the contract

### Phase 3: Deck and logging (gate: full session logged on Auggie's phone)
3.0 Carry-overs from Phase 2 review: cumulative `byWeek` (D-023), HashRouter (D-022), Sunday check on `startDate`, rest days render the daily section
3.1 Deck navigation: sections in order, tile stack, progress, rest timer
3.2 Per-set rows with last-week defaults
3.3 Parser and free-text row input (D-011); dictation tested on device
3.4 Check-off tiles for warmup, cooldown, daily; cardio tile with minutes
3.5 Session summary and Exercise Log screen
3.6 Real-device acceptance: one full session, every section, no fallback

### Phase 4: Model (gate: one approved reprogramming diff)
4.1 Settings: key entry, model string, test call
4.2 Reprogramming prompt: current program, last week's sessions, profile fields, rules that Auggie supplies (e.g. one heavy variable per week); output constrained to the Program JSON schema
4.3 Diff view and approval flow (D-016)
4.4 Meals: day entry, parse call, totals

### Phase 5: PWA and backup (gate: installed on home screen, export verified)
5.1 Manifest, icons, service worker for the app shell
5.2 Export JSON via share sheet; import of a full export
5.3 Storage persistence request; document behaviour observed on device (see O-2)
5.4 README for the open-source audience: what it is, BYO key, how to import your own program

### Phase 6: Foundation (gate: app unchanged in behaviour, 1b colours in light and dark, schema v2 and database v3 live, contracts and design committed)
6.1 Commit PLAN v1.5, DECISIONS D-025 to D-036, schema v2, design briefs v2 and v2.1, the v2 design canvas; md5 against section 8
6.2 1b colour tokens, light and dark (section 12); colours only, no layout changes
6.3 Program types and importer for schema v2; version 1 files upgrade in memory
6.4 IndexedDB version 3: `goals`, `sentLog`, stored programs rewritten to schemaVersion 2
6.5 Export envelope version 2, reading 1 and 2
6.6 Settings fields from section 5 (stored only; no new UI)
6.7 `npm run verify` also prints md5 for `design/`

### Phase 6: shipped Sep 28, 2026 (PR #7, merge 4c64790); served JS and CSS verified byte-identical to a fresh build of the merge

### Phase 7: Onboarding and goals (gate: a fresh install reaches Today through onboarding with a starter program, on Auggie's iPhone)
7.1 Schema correction D-038; confirm the private seed still validates
7.2 Starter programs and their record committed by hash (D-037)
7.3 Onboarding, frames 1a to 1l, in the 1b layout, light and dark
7.4 Goal setter, frame 5a, reached from the existing Profile screen
7.5 First-run routing: onboarding only when there is no program and onboarding was never completed; an existing install (Auggie's) is never sent through it
Phase-7 limit: "Build it with forms" (frame 1d) is hidden until Phase 8 builds the builder; step 4 then offers starter programs and file import only. The app is not promoted to strangers before Phase 8 (O-7), so no one meets the gap.

### Small change 7.1 after Phase 7 (gate: Units and Appearance in Settings, verified on Auggie's iPhone in all three appearances)
Settings gains Units (D-040) and Appearance (D-039); the not-advice banner leaves onboarding (D-041). Executor prompt EXEC-07.1.

Phase 7 and small change 7.1: shipped Sep 28, 2026 (merges ac6247f and 877618f); served bytes verified for Phase 7; device checks reported done by Auggie.

### Phase 8: Builder (gate: on Auggie's iPhone, a program built with forms, the current program edited, an item with history retired and still in Log)
Frames 2a to 2j, rules in D-042.
8.1 Builder screens 2e to 2j (forms path) and 2a to 2d (starter path, swap picker, exercise detail)
8.2 Entry points: onboarding step 4 "Build it with forms" (Phase 7 limit ends) and frame 2a after choosing a starter; Profile "Edit program" and "Start a new program"
8.3 Draft persistence, id generation, history checks, retire and swap rules (D-042)
8.4 Exercise library and custom exercises (D-042 rule 7)

Phase 8: merged Sep 28, 2026 (d5b2478) before chat verification finished. Verification then found starter swaps grouped by weekday `name` instead of session `focus` (a swap on 3-day Full body A changes Monday but not Friday). Not reachable by Auggie's install; no one else uses the app yet. Fixed as the first task of Phase 9, by Auggie's decision. Also found: EXEC-08 wrongly said the sample has an alternate exercise (it has none); Phase 9 adds the alternate round-trip test.

### Phase 9: AI flows (gate: on Auggie's iPhone, one review applied line by line and one update approved, both through the preview, both in the sent log)
9.0 Phase 8 fix: group starter days by `focus`; alternate round-trip test
9.1 One payload builder per call, used for preview and request (D-044); Profile fields no longer sent
9.2 Send preview (4h, 4i) before every call, including the existing meals call (D-045); sent log (5h)
9.3 AI review: banner (4a, 4b), result per line (4c, 4d), applied to the base program (D-043)
9.4 Update program sheet (4e) and whole-patch update (4f, 4g) with the week-N / N+1 rule (D-043)
9.5 Privacy level screen (5e) reached from Settings
9.6 Validation errors name the key (D-043 rule 4)

Phase 9: merged Sep 28, 2026 (6858dcf).

Phase 10 is split in two so each merge stays reviewable: 10A the training loop, 10B meals and targets.

### Phase 10A: Training loop in 1b (gate: a full session on Auggie's iPhone in the new deck; a progression chip seen; week-against-week in Log)
Frames 3a to 3m. Progression suggestion (D-047), felt off flags (D-048), dictation hint, demo slot, Log week-against-week, Week future weeks and swaps.

Phase 10A: merged Sep 28, 2026 (24ed3fb). Found in verification: Log shows an exercise id instead of its name after a session-only swap to a library exercise no stored program contains; fixed as the first task of 10B.

### Phase 10B: Meals and targets (gate: on Auggie's iPhone, a meal day with baseline lines counted on the phone, one unmatched line resolved, and the target shown)
10B.0 Log names also come from the exercise library
10B.1 Baseline foods and line grammar (D-049); results record their source
10B.2 Calorie and protein target (D-046, D-049 rule 4) with the floor state (3p)
10B.3 Goal setter current stats gain height, age, sex and activity (D-046)

Phase 10B: merged Sep 28, 2026 (013a882).

### Phase 11: Settings, privacy and polish (gate: every frame, light and dark, on Auggie's iPhone; Android on a real phone if one is available, otherwise Chrome's Android emulation, labeled as emulation)
Frames 5b to 5j, 7a to 7e, all `-dark` frames. Cross-device check. Two corrections to frame 5c: add the Appearance row under Units (D-039), and show the stored model name, default `claude-sonnet-5` (D-005), not the frame's `claude-sonnet-4-5`.

Phase 11: merged Sep 28, 2026 (f0dd5d2).

### Small change 11.1: two-box set entry (gate: on Auggie's iPhone, "135" and "5" entered in the two boxes save as 135 × 5 on a first session and with last week's placeholders)
D-051. A live defect found by Auggie on his phone; ships before the retrospective. The white first screen he reported is investigated separately until he identifies which screen it is.

Small change 11.1: merged Sep 28, 2026 (70109a3) before chat verification finished; verification found the D-053 defect.

### Small change 11.2: pre-fills never become data (gate: on Auggie's iPhone, a first-session exercise with set 1 logged and Done tapped leaves sets 2 onward empty)
D-053. Executor opens the pull request as a draft; Auggie marks it ready only after chat verification (process change after two merges before verification: Phase 8 and 11.1).

Small change 11.2: merged Sep 28, 2026 (ccd5696). Its device gate is still open.

### Small change 11.3: set boxes and the keyboard (gate: on Auggie's iPhone, installed app, no contact AutoFill on any set box, the focused row stays visible, "15–20" and "8–10" placeholders unclipped; the open device gates for Phases 9 to 11.2 checked in the same session)
D-054. Three defects found by Auggie on his phone; the diagnosis was tested in chat before this contract (D-054 records what was and was not reproduced). Executor prompt EXEC-11.3; pull request as a draft.

Small change 11.3: merged Sep 29, 2026 (11672a1). Served JS and CSS matched a fresh build of the merge on 10 of 10 fetches each (run on Auggie's Mac; chat's sandbox cannot reach github.io). The app takes a new version only when the user taps Reload on the update banner. Device check Sep 30, 2026 (D-064): the contact AutoFill bar remains and is accepted as cosmetic; the focus label works and set 1 stays visible; sets 3 and later and the range placeholders are still to check.

### Small change 11.4: Week day detail and builder fixes (gate: on Auggie's iPhone, the day detail's button and last row fully visible above the tab bar, no badge, cues shown; opening and leaving the builder leaves no draft; the length stepper stops at the current week with the hint only there)
D-059. Five defects found by Auggie on his phone and reproduced in chat. Executor prompt EXEC-11.4; pull request as a draft. Independent of the 11.3 device result: it touches Week, the builder and the stepper, not the deck.

Small change 11.4: merged Sep 29, 2026 (40730de). Served JS and CSS matched a fresh build of the merge on 10 of 10 fetches each (run on Auggie's Mac). Device gate open.

The small change 11.5 "Do this today" in v1.16 is cancelled: D-062 builds it with all swaps and Replace in Phase 12.

### Small change 11.5: plan sheet with reorder, add set, banner hidden while typing (gate: on Auggie's iPhone, Plan opens the sheet, tapping an item jumps to it, moving a Main item into Accessories ahead of another changes the Next tile, moving the current item later makes the next one current, the next session of that day shows the original order unless "Keep this order" was tapped, End from the sheet ends the session; a set added today is logged and absent next week unless kept; the banner is hidden while a set box has focus)
D-063, D-055, D-064 rule 2 and D-065. Inside the deck and the session summary; today's order and added sets are stored with the session. Executor prompt EXEC-11.5; pull request as a draft. Drafted before the 11.4 device check at Auggie's request (Sep 30, 2026): it touches only the deck and its summary.

Small change 11.5: merged Sep 30, 2026 (67ddd3d). Served JS and CSS matched a fresh build of the merge on 10 of 10 fetches each (run on Auggie's Mac). Device gate open. Executor judgment kept: the banner is hidden with `visibility: hidden`, keeping its space, because removing it made the ✓ tap miss when the banner returned on blur (verified in chat with a real tap). Two gaps against D-061 noted at review, to be scheduled: a section emptied today cannot be moved back into from the sheet, and "Keep this order" can leave an empty section in the program.

Served-bytes check: after every merge Auggie runs the one-line command (his choice, Sep 30, 2026), because chat's sandbox cannot reach github.io.

### Small change 11.6: security hardening (gate: `npm audit` reports 0; no schema compiled in the browser; the built page carries the D-066 policy and every main route works under it on Auggie's iPhone, including one AI call; Actions pinned to SHAs; Dependabot config present)
D-066. Executor prompt EXEC-11.6; pull request as a draft.

Small change 11.6: merged Oct 1, 2026 (32b935e). Served JS and CSS matched a fresh build of the merge on 10 of 10 fetches each (run on Auggie's Mac). Device gate open: every tab, one import and one AI call on the iPhone under the policy. The push needed the `workflow` token scope for `deploy.yml`; it was granted for the push and removed after (`gh auth status` showed `gist`, `read:org`, `repo`). Future changes under `.github/workflows/` follow the same grant, push, remove cycle. Dependabot's first run opened nine pull requests; they stay unmerged (D-067 rule 3).

Hosting rule (Oct 1, 2026): the fitday fork was deleted (its site returns 404) because it shared the `augustinepaulm.github.io` origin with BYOB-fit, and any code on that origin can read BYOB-fit's storage, including the API key. BYOB-fit is the only GitHub Pages site on the account (`gh api user/repos` listed only BYOB-fit). No other Pages site is published from this account while BYOB-fit lives on that origin; the rule ends when BYOB-fit moves to its own origin in the public release.

### Small change 11.7: navy tab bar, dependable End, quieter Dependabot (gate: on Auggie's iPhone, the navy tab bar in light and dark with the active tab clear; End shows its confirmation every time, with the keyboard open, during rest and scrolled down; Dependabot's next run opens at most one grouped pull request per ecosystem and none for a major version)
D-067. Executor prompt EXEC-11.7; pull request as a draft. The End defect was not reproduced in chat; the change hardens the likely causes and the device check decides.

Small change 11.7: merged Oct 1, 2026 (b16b8d8). Then Dependabot's grouped pull request #31 (seven minor and patch updates; only react-router-dom 7.18.3 to 7.18.4 ships to phones) was merged before chat verified it (691ddb7). Verified afterwards on 691ddb7: 360 tests, lint, 0 audit findings, build and verify pass, the D-066 policy is present, and the tab bar and End dialog work by touch with no policy violation. Rule restated: Dependabot pull requests go through chat verification like any change. Served-bytes check for 691ddb7 and device gates for 11.6 and 11.7 open.

### Phase 12: Change a day, add and change exercises, edit from Log (gate: on Auggie's iPhone, installed app: change this Friday to Monday's workout, Monday is unchanged and Friday shows "Changed (was ...)", Restore puts it back; change a future week's date; "Do this today" from a future day; Change mid-workout after two logged exercises, both stay in Log and the new workout starts; add an exercise from the plan with its prescription and keep it; swap an exercise and log it with its own prescription; edit a logged set in Log and see it as next time's reference; your existing data and an export from before the upgrade both load with every date showing the same workout as before)
D-069 (Phases 12 and 13 of v1.20 combined, Auggie's choice). One contract, EXEC-12, and one draft pull request built as three commits: data and migration, then days, then exercises, each with its tests, so each can be verified and reverted alone.

Phase 12: merged Oct 2, 2026 (d369117). Verified before merge commit by commit (A 372, B 386, C 405 tests; verify and lint at each) and with an upgrade test: data written by the then-live build opened at database version 4 with the week-plan store converted to two day changes and identical days on Week. Auggie chose to merge without exporting a backup. Served-bytes check and device gate open.

### Small change 11.8: bug fixes from Oct 2 (gate: on Auggie's iPhone, installed app: a Plan sheet move to the current position makes that exercise current; after a move and reopen the sheet scrolls by touch first try, three times running; Done during rest restarts rest; the summary shows "Compared with last week" and "Ready to progress" and no volume; no last-week value appears without a weight on a load exercise; Change is gone on a finished day; the draft message offers Open and Discard; pulling past the top or bottom of each tab leaves no gap under the tab bar)
D-074. Executor prompt EXEC-11.8; pull request as a draft, as two commits. Phase 13 (EXEC-13 v1.0, delivered Oct 2 and not run) waits and is reissued afterwards against the new `main`.

Small change 11.8: merged Oct 2, 2026 (5bbfcd7). A fresh chat build of the merge gave index-CETPr0Lg.js ee121e8c56d66e2087734418522ccf5c and index-C3iOR89K.css 145e06afff0fcae57f15f541d9745857; served-bytes check and device gate open.

### Small change 11.9: finished dates and ending a session (gate: on Auggie's iPhone, installed app: start today's workout, log a set, change today from the Plan sheet; Week still offers Change and Restore on today, and Restore puts the first workout back as Done; End a workout with an exercise not done, leave the summary without tapping Done, and Log offers Edit on that session; Swap mid-workout opens with Same muscles off)
D-075, with D-072 rules 2 and 3. Executor prompt EXEC-11.9; pull request as a draft, as two commits (Week and days; deck and session). Taken ahead of the design rework by Auggie, Oct 2, 2026, because none of it changes a layout.

Small change 11.9: merged Oct 2, 2026 (974ddbf; its tree is identical to the verified branch tip 6621164). Verified in chat before merge: each commit passes on its own (437 and 450 tests, lint, build, verify), 0 audit findings, the D-066 policy present, and checks 9b, 9d and 9f reproduced in Chromium under the policy (WebKit could not be downloaded in chat's sandbox). Expected served bytes: index-CalJGyEY.js dc240b637c662d210f0907c9ec559c7b, index-C3iOR89K.css 145e06afff0fcae57f15f541d9745857. Served-bytes check and device gate open. Found in verification, decision open: Start then End with nothing logged leaves today Done with no Change or Restore (option 1: discard an ended session with nothing in it; option 2: leave it). D-080 already excludes such a session from adherence.

### Design rework (gate met Oct 3, 2026: canvas approved by Auggie and received in chat, md5 810513dd6e85976aab00112b50350bca; committed in Phase 13's contracts commit)
D-077 to D-082, `docs/SCORES.md`, `docs/DESIGN-BRIEF-v3.md`. Layouts, flows and navigation may all change, tabs included; the paper ground stays and every other colour is open (D-082). Steps: (1) Auggie runs brief v3 in Claude Design, rounds 1 to 4, approving each; (2) the export `BYOB-fit_v3_design.html` is committed by hash; (3) this chat splits the build into phases against the canvas and reissues Phase 13 (D-070, D-071 as amended by D-078, D-072 rule 1) inside them. Usage and budget (D-070) is built before any new AI call (D-081 rule 3). Open before the phase that builds the Body score: a weight noise band and a skeletal-muscle band (D-080 rule 5).

### Phase 13: The rework (gate: on Auggie's iPhone, installed app, light and dark: every tab in the v3 design with the tab bar shown in a workout; leaving a workout mid-rest and returning keeps the timer and typed boxes; a body entry from an InBody scan; a meal day with nutrients, limits and AI estimate marks; each Progress view with its score, parts and "How this is worked out"; one week review note through the preview; usage and estimated cost after that call, and a budget below it stopping the next call; Start then End with nothing logged leaves the day open; Restore from a backup on a fresh install)
D-070 as amended by D-085, D-071 as amended by D-078, D-072 rule 1, D-077 to D-086, `docs/SCORES.md`, the v3 canvas. One contract, `docs/EXEC-13-rework.md` (EXEC-13 v1.0 of Oct 2 is superseded and never committed), and one draft pull request (Auggie, Oct 3, 2026: "one large PR") built as nine commits after the contracts commit, each passing verify on its own: foundation; data; usage, budget and privacy; body; meals; scores and Progress; week notes; Train restyle; everything else restyled. Database version 5, export envelope version 4.

### Phase 13G: How-to guide (gate: on Auggie's iPhone, the guide opens from Profile and from each "?", and every step it describes matches the screen)
D-073 placement, D-076. Built after the design rework and Phase 13. The text is redrafted against the new screens and recorded as a new decision before the contract runs.

### Phase 14: Retrospective
14.1 Write failures and fixes into the project-execution-protocol skill

## 7. Effort (MODELED)

v1.4 estimate: 5 to 6 weekends to the Phase 5 gate. Actual: two working sessions (git history: Phases 2 to 4 merged between 20:00 and 22:26 on Sep 13; Phase 5 on Sep 27). The estimate was about 3 times too high, so confidence in the next one is low.

Phase 6 actual: one session (contracts Sep 27, merge Sep 28), inside the estimate.

v1.5 method: scale by that measured rate, one session per phase of Phase 2 to 4 size. Phase 6: 1 session. Phases 7 to 11: 1 to 2 sessions each. Total 6 to 11 sessions; 2 to 5 calendar weeks at the pace so far. Outside the code timeline: demo media (O-6), legal review (O-7), starter template review (O-8).

## 8. Integrity table

| File | Role | md5 |
|---|---|---|
| docs/DECISIONS.md | Decision records D-001 to D-086 | ae2efdac7a686790e0d49aa0a5b86fd8 |
| docs/PLAN.md | This file, v1.26 | recorded in chat at delivery (a file cannot carry its own hash) |
| docs/DESIGN-BRIEF.md | Claude Design brief v1.0, placeholder data only | f216f6b548bad5894bbdc974259a6889 |
| docs/DESIGN-BRIEF-v2.md | Claude Design brief v2.0 | de3ff85f61214a2b812b8a5922d60967 |
| docs/DESIGN-BRIEF-v2.1.md | Claude Design brief v2.1 | 4eed874c85c1184cba28c7ebfccf4fad |
| docs/EXEC-01.md | Executor prompt, scaffold | 359389c78a7097dcfbc7162902c618b2 |
| docs/EXEC-02.md | Executor prompt, Phase 2 | da3fa48a359e09cce1487cb8241ddd13 |
| docs/EXEC-03.md | Executor prompt, Phase 3 | 08119055aa3cc751f502340309ffed1a |
| docs/EXEC-04.md | Executor prompt, Phase 4 | 459cb6850b6909aef8dd0dc80619da5f |
| docs/EXEC-05.md | Executor prompt, Phase 5 | f3f96142b65b443e256dd7af0374c49f |
| docs/EXEC-06.md | Executor prompt, Phase 6 | 1baffd43cd4fcbf7f75659434f82c35e |
| docs/EXEC-07.md | Executor prompt, Phase 7 | ef28bdd992bcfb5f2a56196556ffb55f |
| docs/EXEC-07.1.md | Executor prompt, small change 7.1 | 0833be451879134705a7f37a0db19eb2 |
| docs/EXEC-08.md | Executor prompt, Phase 8 | 12d5247c42d150f20a1105a335415365 |
| docs/EXEC-09.md | Executor prompt, Phase 9 | f51e5a90dfd6ec7539c2cf5df539bfd5 |
| docs/EXEC-10A.md | Executor prompt, Phase 10A | 0ce9f9998e3cd4b668f19519a99bfaab |
| docs/EXEC-10B.md | Executor prompt, Phase 10B | 490b7230e2ca66e6dca75f1a88c9f889 |
| docs/EXEC-11.md | Executor prompt, Phase 11 | ea6898335ca531bb76e71f3eee3b0ac9 |
| docs/EXEC-11.1.md | Executor prompt, small change 11.1 | 3b603a8eae7924557cc765e2de0ddf2c |
| docs/EXEC-11.2.md | Executor prompt, small change 11.2 | 6f42111278e61c51897d40f167889cd6 (as committed on main at ccd5696) |
| docs/EXEC-11.3.md | Executor prompt, small change 11.3 | e72214d98b570ef1cc3f0024556ae2fe |
| docs/EXEC-11.4.md | Executor prompt, small change 11.4 | 5fe152524c5ca286844a6b7411c8722a |
| docs/EXEC-11.5.md | Executor prompt, small change 11.5 | de10132a7ab51207d61af2b695433918 |
| docs/EXEC-11.6.md | Executor prompt, small change 11.6 | e45b18e1d938aeb95832d0214faae160 |
| docs/EXEC-11.7.md | Executor prompt, small change 11.7 | 2709b77c2b4fdcc4c6c44a6aa14e66f6 |
| docs/EXEC-12.md | Executor prompt, Phase 12 | 0a46847ffc01d09f42681e7bffd0ff3c |
| docs/EXEC-11.8.md | Executor prompt, small change 11.8 | cf1ad9a18d6ae58fd33391e92f7f54b5 |
| docs/EXEC-11.9.md | Executor prompt, small change 11.9 | 9c51381d240becd7f4c3318b5d05d81c |
| docs/SCORES.md | Scores, nutrient targets and limits, body noise bands, with sources and worked examples (D-079, D-080) | 58305c1c8d40a2f0d5d8648124268cb3 |
| docs/EXEC-13-rework.md | Executor prompt, Phase 13 | recorded in chat at delivery (it checks this file's hash) |
| design/BYOB-fit_v3_design.html | Claude Design canvas v3, 57 frames light and 57 dark, placeholder data; self-contained bundle (React and fonts embedded) | 810513dd6e85976aab00112b50350bca |
| design/BYOB-fit_v3_README.md | Claude Design handoff notes for the v3 canvas (uploaded as README.md) | f6d6af7ea22521841cf8f40883f80174 |
| docs/DESIGN-BRIEF-v3.md | Claude Design brief v3.0, the rework, placeholder data only (D-082) | 7692e52739a4562552691cb95d01141e |
| docs/TARGETS-AND-PROGRESSION.md | Calorie target and progression rule, sources and worked examples (D-046, D-047) | f272d7840a5db2129040dbccd7e5ebfe |
| docs/STARTER-PROGRAMS.md | Starter program rules, sources, coverage matrix (D-037) | ed27f8fbde2794c79499d631db38f191 |
| public/templates/starter-3day-fullbody.json | Starter program, beginner | 9b2abfe2ae59a0aba3e80f94290401b2 |
| public/templates/starter-4day-upper-lower.json | Starter program, intermediate | 9c530c1784051b4c2e19cd66a206184c |
| public/templates/starter-5day-split.json | Starter program, experienced | 1d6934c21f157f6733a5527bb14d4f55 |
| design/BYOB-fit_Design.html | Claude Design export v1, seven screens, placeholder data | 52e9bae37b40670779a7acb0b1801806 |
| design/BYOB-fit_v2_design.dc.html | Claude Design canvas v2, 124 frames (62 light, 62 dark), placeholder data. Reference only: it loads `./support.js`, which is not included, so it does not render on its own; read its markup | 9a9efdfa60041f89fd173b2992215554 |
| docs/program.schema.json | Program file contract, schema v2, frozen Sep 27, overrides closed Sep 28, progression field Sep 28 | 05f7ae141dfa800c24e46588845ad5da |
| public/sample-program.json | Generic sample program (schemaVersion 1, valid under v2) | 8416d1974b9746f2172f8b73c493a0f9 |

Sequence for every delivered file: download → copy into repo → `md5` against the recorded value → `git add` → commit. Not saved until the hash check passes in the repo.

## 9. Verification standards (from the project-execution-protocol skill)

Served-bytes vs fresh local build for anything deployed. Visual acceptance on Auggie's iPhone, not a simulator. One error found = re-verify the whole class. Executor never restyles, improves, or self-rates; reports PASS/FAIL per task number; stops for scope changes, destructive actions, and production deploys.

## 10. Backlog (parked, named, not blocking)

B-1 In-app microphone (D-019) · B-2 Relay server and accounts (D-020) · B-3 Closed: demos are in scope (D-033), source in O-6 · B-4 Charts beyond simple trends · B-5 Sharing a week summary as an image · B-6 Multiple programs per user (one active program; past programs kept for history is a later decision) · B-7 Health-app and wearable sync (would likely bring the FTC Health Breach Notification Rule into play; see O-7) · B-8 Local progression engine beyond the chip in frame 3b · B-10 Convert an existing program between kg and lb as an explicit action (D-040) · B-11 App icon in the 1b direction (D-050) · B-9 Home-equipment versions of the starter programs (stated by Auggie Sep 28, 2026: after the complete build) · B-12 In-app number pad for set entry: would remove the iOS keyboard from logging (and with it the contact AutoFill and keyboard scroll problems) but ends keyboard dictation for sets and supersedes D-051's native keypads; D-054 rule 1 did not stop the contact suggestion (D-064); the bar is accepted as cosmetic and this stays parked · B-13 Opening today and past days from Week to review logged sets or "Missed" (proposed in the Sep 29 bug handoff; Log already shows past sessions)

## 11. Open items

O-1 Resolved Sep 12, 2026: BYOB-fit, BYOB expanding to Build Your Own Body; logo and marketing use that expansion
O-2 Rewritten Sep 27, 2026: Phase 5 records the result of `navigator.storage.persist()` on the device; it does not observe whether iOS actually keeps the data. Hypothesis unchanged and unverified: installed home-screen apps are exempt from Safari's storage clearing. Export (D-017) plus the monthly backup reminder (frame 5d) is the mitigation either way. Close only with an observation on Auggie's iPhone after at least 7 days without opening the app
O-3 Exercise how-to text: drafted by Claude in the v11 seed (115 exercises); Auggie edits in the seed file; not blocking
O-4 Resolved for goals by D-030; Profile keeps free label/value fields for anything else
O-5 Resolved in Phase 4: reprogramming rules are a Settings text field the user writes
O-6 Demo media: source (made in-house, licensed, or openly licensed), licence terms compatible with an MIT repo, format and size per clip. Blocks filling the demo slot, not building it
O-7 Legal review before promoting the app to strangers (also: Anthropic's Commercial Terms say those services are not for consumer use, and require users to be told outputs may be inaccurate; checked Sep 28, 2026): whether a no-server app counts as collecting consumer health data under Washington's My Health My Data Act, and the wording of the privacy page. Not blocking any build phase
O-8 Resolved Sep 28, 2026 by D-037
O-9 Resolved Sep 28, 2026 by D-046
O-11 Resolved Sep 28, 2026: dropped from Full; Full sends current weight only (D-044). Height, age and sex are collected on the phone for the calorie target only (D-046)
O-10 Resolved Sep 28, 2026 by D-047
O-12 Content blurred under the iOS status bar in the installed app (BUG-08, Sep 29, 2026). Developer reports, not Apple documentation, say iOS 26 draws a blur over the top of installed web apps and skips it when a fixed box with a background covers the top edge; not verified on iOS 27 or on this app. Needs a screenshot at rest, with the disclaimer showing and dismissed. Moving the disclaimer is a decision for O-7, not a layout fix

## 12. Visual tokens (D-034)

Extracted Sep 27, 2026 from `design/BYOB-fit_v2_design.dc.html`. Dark values for ground, ink, secondary, muted, hairline, accent, done and End are stated on the canvas's dark-mode board; every other pairing was matched by frequency of use across the 62 light and 62 dark frames and is marked (paired).

| Role | Light | Dark |
|---|---|---|
| Ground | #f5f2ec | #171512 |
| Raised surface | #fbfaf7 | #1e1b17 (paired) |
| Subtle fill | #ebe5da | #24211c (paired) |
| Ink, primary text | #1b1a17 | #ede8df |
| Secondary text | #5f5a50 | #b3ab9e |
| Muted text | #8f897d | #8a8276 |
| Placeholder, faint icon | #bdb3a3 | #5a5348 (paired) |
| Hairline | #ddd5c8 | #36312a |
| Field and control border | #cfc6b7 | #4a443b (paired) |
| Idle chip | #e4ddd0 | #2a2620 (paired) |
| Accent | #1f3a5f | #8fb0d9 |
| Text on filled accent | read from frame 1a | #101a26 |
| Accent soft fill (banners) | #e2e7ee | #22303f (paired) |
| Done, success | #2e7d4f | #5bb887 |
| End, danger | #b0413a | #e07868 |
| Warning | #a8641c | #e0a560 (paired) |
| Warning text on warning fill | #7a4a0f | #f1c98a (paired) |
| Warning fill | #f1e3c8 | #3a2c14 (paired) |
