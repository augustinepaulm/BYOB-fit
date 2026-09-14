# BYOB-fit: Governing plan

BYOB = Build Your Own Body (STATED, Sep 12, 2026). Repo and app name: BYOB-fit.

Version: 1.2 · Date: Saturday, Sep 12, 2026 · Owner: Auggie · Chat pipeline: this Claude chat (decisions) · Execution pipeline: Claude Code in VS Code (implementation)

Provenance convention throughout: STATED (Auggie) · VERIFIED (checked in chat, with source) · MODELED (Claude's estimate, method shown) · DEFAULT (Claude's proposal pending redirect).

## 1. Purpose and scope

An open-source, home-screen workout app for one user (Auggie) that: shows the day's session as a grouped checklist; runs it as a deck of exercise tiles with per-set logging and last-week targets; accepts typed or dictated entries; keeps a meal log in the DFS-plus-delta convention; holds a profile and goal; and, once a week, asks a model the user supplies a key for to write next week's program from the logs. All data stays on the phone except the weekly model call.

Out of scope for v1: other users, accounts, app stores, animations, external exercise datasets, in-app microphone, relay servers. See DECISIONS.md D-018 to D-021.

Success test for v1 (STATED goal, MODELED test): Auggie logs a full week of v10 sessions in the app on his phone, with no paper or FitDay fallback, and the weekly reprogramming call returns a proposal he would act on.

## 2. Decisions in force

All decisions live in DECISIONS.md (checksummed in section 8). Summary of the frozen set: PWA · React + Vite + IndexedDB · GitHub Pages, public repo, personal data via gitignored import · direct browser call to Anthropic with BYO key · claude-sonnet-5 default · two model jobs · six screens · Today-to-deck with per-set logging and last-week defaults · keyboard dictation plus parser · kg display, Sunday week · sections not flat lists.

## 3. Inputs (private, never committed)

| Input | Provenance | Where it lives |
|---|---|---|
| Training program v10 | STATED, pasted into chat Sep 12, 2026; source-of-truth build is the FitDay fork index.html, md5 ce20664fb136ad4548c1659f1341afe9 (Auggie's figure, not re-verified here) | Converted to `seed/program.json`, gitignored; imported on first run |
| Exercise descriptions | To be written per item; STATED where Auggie supplies, DEFAULT where Claude drafts | Inside the seed program file |
| Profile and goal fields | STATED by Auggie at first run, typed into the app | IndexedDB only |
| Anthropic API key | Auggie's own | IndexedDB only, entered in Settings |

The pasted v10 document also carries measured, stated and modeled health context. None of it enters the repo, the plan, or any committed file. The app stores only what Auggie types into Profile.

## 4. Screens

| Screen | Content | Model call |
|---|---|---|
| Today | Date, day name, sections with items, expected duration, Start. Swap-week banner if today is a swapped day | No |
| Deck (from Start) | Active tile, next tile, third dim tile; header with section, N of M, progress bar, rest timer; Done advances; End session summary | No |
| Week | Seven day cards, done state, swap action, program week number of 12 | No |
| Exercise Log | Per exercise: history of sets by date, best set, simple trend | No |
| Profile / Goal | Fields Auggie chooses to enter (goal statement, targets, week number, dates); no computed health claims | No |
| Meals | One entry per day in DFS-plus-delta lines; parsed kcal and protein shown after the model call; day and week totals | Yes (parse) |
| Settings | API key, model string, export JSON, import program JSON, reset | Yes (test call) |

Reprogramming lives under Week: "Build next week" runs the model, shows a diff, waits for approval (D-016).

## 5. Data model (DEFAULT, to be frozen at Gate 2)

```
Program        { id, name, weekStartsOn: "sunday", programWeeks: 12, days: Day[7] }
Day            { id, name, order, durationMin, sections: Section[], swappableWith?: dayId }
Section        { id, kind: warmup|main|block|abs|cardio|cooldown|daily, title, items: Item[] }
Item           { id, exerciseId, type: load_reps|bodyweight_reps|timed_hold|distance|cardio_block|check,
                 perSide: bool, sets, repMin, repMax, holdSec, distanceM, minutes,
                 tempo, restSec, rpe, notes, byWeek?: { [week]: partial Item } }
Exercise       { id, name, description, unit: kg|lb, tags[] }
Session        { id, date, dayId, programWeek, startedAt, endedAt, swapped: bool, entries: Entry[] }
Entry          { itemId, sets: SetLog[], checked: bool, note }
SetLog         { n, side?: L|R, weight, reps, seconds, distanceM, minutes, rpe, raw: string }
Profile        { fields: { [label]: value }, updatedAt }
MealDay        { date, lines: string[], parsed?: { kcal, proteinG, items[] }, parsedAt }
Settings       { apiKey, model, lastExportAt }
```

`raw` on SetLog keeps what was typed or dictated, so parser errors can be corrected without losing the input. `byWeek` carries staged prescriptions (plyo progression, calf-raise loading) without duplicating the program.

Parser grammar (D-011), DEFAULT: `<number> (for|x|by|×) <number>` → weight, reps · `<number> (s|sec|seconds)` → seconds · `<number> (m|meters|metres)` → distance · `same` → copy last week's set · `bodyweight` or `bw` → weight 0 · spoken numbers ("twenty two point five") normalised before matching. Unparseable input stays in `raw`, row flagged, never silently zeroed.

## 6. Phases and numbered tasks

Each phase ends at a gate: Claude Code reports PASS/FAIL per task number; this chat verifies; Auggie approves. Production deploy (GitHub Pages) only on Auggie's explicit approval in chat.

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
2.1 Convert v10 to `seed/program.json` (drafted in this chat; Auggie reviews item by item)
2.2 IndexedDB schema and repository layer for all entities in section 5
2.3 Import screen: load seed JSON, validate, activate
2.4 Today and Week screens from the handoff bundle, reading real data
2.5 Sample generic program committed as `public/sample-program.json` for forks

### Phase 3: Deck and logging (gate: full Sunday session logged on Auggie's phone)
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

### Phase 6: Retrospective
6.1 Write failures and fixes into the project-execution-protocol skill

## 7. Effort (MODELED)

Method: one focused weekend per phase for 2 to 5, half a weekend for 0, 1 and 6; assumes Claude Code executes and Auggie directs; assumes no store, no accounts. Estimate: 5 to 6 weekends to the Phase 5 gate. Risks that extend it: parser edge cases from dictation, iOS PWA quirks found only on device, design iteration in Phase 1.

## 8. Integrity table

| File | Role | md5 |
|---|---|---|
| docs/DECISIONS.md | Decision records D-001 to D-021 | a2403900620b790463d5d25045c92190 |
| docs/PLAN.md | This file, v1.2 | recorded in chat at delivery (a file cannot carry its own hash) |
| docs/DESIGN-BRIEF.md | Claude Design brief v1.0, placeholder data only | f216f6b548bad5894bbdc974259a6889 |

Sequence for every delivered file: download → copy into repo → `md5` against the recorded value → `git add` → commit. Not saved until the hash check passes in the repo.

## 9. Verification standards (from the project-execution-protocol skill)

Served-bytes vs fresh local build for anything deployed. Visual acceptance on Auggie's iPhone, not a simulator. One error found = re-verify the whole class. Executor never restyles, improves, or self-rates; reports PASS/FAIL per task number; stops for scope changes, destructive actions, and production deploys.

## 10. Backlog (parked, named, not blocking)

B-1 In-app microphone (D-019) · B-2 Relay server and accounts (D-020) · B-3 Exercise animations or a licensed demo library (D-018) · B-4 Charts beyond simple trends · B-5 Sharing a week summary as an image · B-6 Multiple programs per user

## 11. Open items

O-1 Resolved Sep 12, 2026: BYOB-fit, BYOB expanding to Build Your Own Body; logo and marketing use that expansion
O-2 iOS storage eviction for home-screen PWAs: hypothesis that installed apps are exempt from Safari's storage clearing; not verified; export (D-017) is the mitigation either way; Phase 5.3 records observed behaviour
O-3 Exercise descriptions: who writes them, Auggie or Claude draft for Auggie's review (DEFAULT: Claude drafts, one line each, Auggie edits)
O-4 Profile fields: which fields Auggie wants (DEFAULT: goal statement, program week and dates, weekly targets he chooses to enter; nothing computed by the app)
O-5 Reprogramming rules the model must follow: to be supplied by Auggie as plain text before Phase 4 (the v10 handoff's standing rules are the starting point)
