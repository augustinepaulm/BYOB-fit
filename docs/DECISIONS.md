# BYOB-fit: Decision records

Status legend: FROZEN (approved by Auggie in chat, Sep 12, 2026) · DEFAULT (proposed by Claude, stands unless Auggie redirects) · PARKED (named, not in scope)

Each record: ID · Decision · Rationale · Consequence for build.

## D-001 App type: PWA (FROZEN)
Home-screen progressive web app, installed from a URL. Same class as the FitDay fork. No app stores in v1.
Consequence: web manifest, service worker for offline shell, real-device acceptance on Auggie's iPhone.

## D-002 Stack: React + Vite + IndexedDB (FROZEN)
React with Vite tooling; IndexedDB for all on-device data.
Consequence: no server, no accounts, no cloud database.

## D-003 Hosting: GitHub Pages, public repo (FROZEN)
Repo is open source. Nothing personal is ever committed: no program, no logs, no biometrics, no API key.
Consequence: personal data enters via a JSON import on first run; the seed file is gitignored; a generic sample program ships in the repo for anyone who forks it.

## D-004 Model access: direct browser call, bring your own key (FROZEN)
The app calls the Anthropic Messages API directly from the phone with the header `anthropic-dangerous-direct-browser-access: true`. The key is entered once in Settings and stored on device only.
Rationale: verified in chat that Anthropic supports CORS for this pattern; GitHub Pages has no server to hold a key. A relay (Cloudflare Worker) is parked (D-020).
Consequence: once a week the log and goal leave the phone to Anthropic under Auggie's own account.

## D-005 Default model: claude-sonnet-5, switchable (FROZEN)
Model string editable in Settings.

## D-006 Model jobs in v1: two only (FROZEN)
1. Write next week's program from the logged sets, the current program, and the goal.
2. Parse meal lines written in Auggie's DFS-plus-delta convention into kcal and protein.
Nothing else calls the model.

## D-007 Screens: six (FROZEN)
Today · Week · Exercise Log · Profile/Goal · Meals · Settings.

## D-008 Today-to-deck interaction (FROZEN)
Today opens as a grouped checklist with a Start button. Start enters the deck: the active item is the large tile; the next item is a smaller tile below it, with a third, dimmer tile behind. Header shows section, item N of M, a progress bar, and a rest timer.

## D-009 Per-set logging with last-week defaults (FROZEN)
Main-work tiles log one row per set: weight and reps (or seconds, or distance, by item type). Each row shows last week's numbers for that set and pre-fills them; Done confirms defaults, typing only on change.

## D-010 How-to collapsed by default (FROZEN)
Each exercise carries a text description, shown on tap. No animations in v1 (D-018).

## D-011 Voice input: keyboard dictation plus parser (FROZEN)
Each set row accepts one free-text input that the app parses: "22.5 for 8", "22.5 x 8", "twenty two point five for eight", "same" (repeat last week), "45 seconds". Voice comes from the iOS keyboard mic key into that field. In-app mic is parked (D-019).
Rationale: single source states the Web Speech API works in iOS Safari but not in installed web apps; keyboard dictation is an OS feature and works anywhere.

## D-012 Units and week (FROZEN, carried from FitDay decisions)
Kilograms as the display unit, with the ability to record an item's load in lb where the equipment is labelled that way (the v10 program mixes both). Week starts Sunday.

## D-013 Day structure: sections, not a flat list (DEFAULT)
A day is an ordered list of sections. Section kinds: warmup, main, block (e.g. back block), abs, cardio, cooldown, daily. Items in main, block and abs are logged per set; cardio items log minutes plus a note; warmup, cooldown and daily items are check-off tiles.
Rationale: the v10 program has five to six sections per day; forcing them into one list would either lose structure or drown the lifts.

## D-014 Item types (DEFAULT)
load_reps · bodyweight_reps · timed_hold (seconds) · per_side (wraps any of the above with left/right) · distance (metres) · cardio_block (minutes, intensity note) · check (no data). Prescription fields: sets, rep range (min, max), hold seconds, tempo, rest seconds, RPE, notes, and optional per-program-week overrides (for staged items like the plyo progression).

## D-015 Week screen actions (DEFAULT)
View the seven days; swap two days (the program's Wed/Thu rule); mark a day done; see completion. Swaps are logged so the reprogramming call sees them.

## D-016 Weekly reprogramming gate (DEFAULT)
The model proposes next week's program as a full JSON program; the app shows a diff against the current week; Auggie approves or edits before it becomes active. The model never writes to storage directly.

## D-017 Export and backup (DEFAULT)
Export everything (program, logs, profile, meals, settings minus key) as one JSON file via the share sheet. Export is the backup path regardless of iOS storage behaviour (see open item O-2).

## D-018 No animations, no external exercise dataset (FROZEN)
Descriptions are text supplied with the program. External libraries and animated demos are out of v1.

## D-019 In-app microphone (PARKED)
Revisit after a real-device test of the Web Speech API in home-screen mode, or via an audio-to-text provider (would need a second key; not verified that the Anthropic key covers it).

## D-020 Relay server, accounts, app stores (PARKED)
Trigger to revisit: anyone other than Auggie using the app without their own key.

## D-021 Private repo (PARKED)
Superseded by D-003 for this project; the FitDay fork's open question (Cloudflare Pages vs GitHub Pro) is unaffected.

## D-022 Client-side routing: HashRouter (FROZEN, Sep 14, 2026)
Routes live after `#` (`/BYOB-fit/#/week`). GitHub Pages has no SPA fallback, so a BrowserRouter deep link or a home-screen restore to `/week` returned GitHub's 404. Found by the executor after the Phase 2 deploy.

## D-023 byWeek overrides are cumulative (FROZEN, Sep 14, 2026)
For week W, every override with key <= W applies in ascending order on top of the base item, later keys overwriting earlier ones field by field. Replaces the Gate 2 wording "applies from that week onward until a higher key takes over", which the executor read as greatest-key-wins; the two readings diverged on one seed item (walk-jog logging from week 10). Chat and executor found it independently.

## D-024 Production approval is the merge (FROZEN, Sep 14, 2026)
Auggie merging a pull request into `main` on GitHub is the explicit production approval PLAN section 6 refers to. The executor never merges and never needs to infer approval.
