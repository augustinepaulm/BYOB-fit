# BYOB-fit: Decision records

Status legend: FROZEN (approved by Auggie in chat; date on each record, Sep 12, 2026 unless stated) · DEFAULT (proposed by Claude, stands unless Auggie redirects) · PARKED (named, not in scope)

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
Amended Sep 27, 2026: a third job, the AI review pass (D-026); meal parsing is local-first (D-032); every call is limited by the privacy level and shown in a preview first (D-031).

## D-007 Screens: six (FROZEN)
Today · Week · Exercise Log · Profile/Goal · Meals · Settings.
Amended Sep 27, 2026: onboarding (D-029), the program builder (D-028), and Settings sub-screens (privacy level, sent log, privacy page, safety notice) are added. The five bottom tabs are unchanged: Today, Week, Log, Meals, Profile.

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
Amended Sep 27, 2026: the display unit is the user's choice, set in onboarding (frame 1i) and Settings; each item's load keeps the unit it was recorded in, with no conversion. Week still starts Sunday.

## D-013 Day structure: sections, not a flat list (DEFAULT)
A day is an ordered list of sections. Section kinds: warmup, main, block (e.g. back block), abs, cardio, cooldown, daily. Items in main, block and abs are logged per set; cardio items log minutes plus a note; warmup, cooldown and daily items are check-off tiles.
Rationale: the v10 program has five to six sections per day; forcing them into one list would either lose structure or drown the lifts.

## D-014 Item types (DEFAULT)
load_reps · bodyweight_reps · timed_hold (seconds) · per_side (wraps any of the above with left/right) · distance (metres) · cardio_block (minutes, intensity note) · check (no data). Prescription fields: sets, rep range (min, max), hold seconds, tempo, rest seconds, RPE, notes, and optional per-program-week overrides (for staged items like the plyo progression).

## D-015 Week screen actions (DEFAULT)
View the seven days; swap two days (the program's Wed/Thu rule); mark a day done; see completion. Swaps are logged so the reprogramming call sees them.

## D-016 Weekly reprogramming gate (DEFAULT)
The model proposes next week's program as a full JSON program; the app shows a diff against the current week; Auggie approves or edits before it becomes active. The model never writes to storage directly.
Superseded in part Sep 27, 2026 by D-025: the model returns a patch, not a full program, and the user approves all or discards; there is no edit step.

## D-017 Export and backup (DEFAULT)
Export everything (program, logs, profile, meals, settings minus key) as one JSON file via the share sheet. Export is the backup path regardless of iOS storage behaviour (see open item O-2).

## D-018 No animations, no external exercise dataset (FROZEN)
Descriptions are text supplied with the program. External libraries and animated demos are out of v1.
Superseded Sep 27, 2026 by D-033: visual demos are in scope, bundled with the app. No external exercise dataset is loaded at runtime.

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

## D-025 Weekly update is a patch, approved whole (FROZEN, Sep 27, 2026; records Phase 4 behaviour)
The model returns `{ week, overrides[], add[], remove[], notes }`, each change with a reason (EXEC-04 task 5). The app validates every id and field against the schema, shows one diff grouped by day, and offers Approve all or Discard. Invalid output is shown with its errors and never applied.
Rationale: EXEC-04 cited D-025 but the record was never committed; this writes it down as shipped.
Consequence: design frames 4f and 4g. Supersedes the D-016 wording.

## D-026 AI review pass: on request, line by line (FROZEN, Sep 27, 2026)
Once a program and a goal both exist, a dismissible banner on Today and Week suggests a review (frames 4a, 4b); nothing runs until the user taps Review. The result lists each proposed change with a reason and its own Accept and Reject; nothing applies until "Apply accepted changes" (4c, 4d).
Rationale: a new or edited program deserves scrutiny per change; the weekly update (D-025) stays whole-patch because it is a routine adjustment. Never automatic because each call spends the user's money under their key.
Consequence: a third model job (amends D-006). Dismissing hides the banner for that program id.

## D-027 Update the program at any time (FROZEN, Sep 27, 2026)
"Update program" on Week offers "Edit it myself" (the builder on the current program, D-028) or "Ask AI" (frames 4e to 4g). An AI update uses the sessions logged so far and applies from the next day not yet started, stated on the proposal ("Applies from Thursday").
Consequence: replaces v1's "Build next week" card. A mid-week update may change only items on days not yet started this week (as `byWeek` overrides keyed to the current week, which carry forward per D-023); validation rejects any change to a day already started.

## D-028 Program builder: one editor, two entry points (FROZEN, Sep 27, 2026)
"Start a new program" (template or blank) and "Edit current program" open the same screens: settings, days, day editor, item editor, review (frames 2a to 2j). The draft persists across navigation until saved. Validation errors show inline on the field. An item with logged history is retired, never deleted: it gains `retiredFrom` and stays in the Log (2i). Item and exercise ids are never renamed or reused.
Consequence: schema v2 (D-035). Edit-in-place resolves the open builder question from the Sep 2026 handoff.

## D-029 Onboarding with a safety notice, not a questionnaire (FROZEN, Sep 27, 2026)
First run is eight steps (frames 1a to 1l): welcome; two branching questions (follows a program, new or experienced); safety notice; program source (build with forms or import, or a starter template); goals; units; optional AI setup with privacy level; summary. Step 3 is a notice with exact approved wording and one button; the app stores only the acknowledgement time, never health answers.
Rationale: a questionnaire whose answers change nothing collects health data for no benefit and raised licensing questions about published screening forms.
Consequence: replaces Import as the first-run path; Import stays reachable. The notice is also reachable from Settings (5j).

## D-030 Structured goals (FROZEN, Sep 27, 2026)
Goals are chosen, not typed: one main goal and up to two more from lose weight, lose body fat, build muscle, get stronger, improve cardio, general fitness; each with a relative target and unit; a timeframe of 4, 8, 12 or 16 weeks; ranked (frames 1f to 1h, 5a). Current weight and body fat are optional, stored on the phone and never sent to the model.
Consequence: new `goals` store. Resolves O-4 for goals; Profile's free label/value fields remain for anything else.

## D-031 AI privacy levels, send preview and sent log (FROZEN, Sep 27, 2026)
Every model call sends only the fields allowed by the privacy level and opens a preview of exactly what will be sent (frames 4h, 4i). Minimal (default for everyone): program structure, exercises, sets, weights, reps, dates, structured goal, the user's rules text. Standard adds experience level and "felt off" notes. Full adds age range, sex and current weight, and free-text notes by opt-in. Never sent at any level: name, date of birth, body-stat history. Users who choose New in onboarding see a one-line suggestion to pick Standard; it is not pre-selected. Every call is recorded on the phone in a read-only sent log (5h).
Rationale: the maintainer receives nothing; what Anthropic receives is minimized and visible to the user before it leaves.
Consequence: amends D-006's "profile fields". Privacy level set in onboarding (1k) and Settings (5e).

## D-032 Meals: local first, calorie target on the phone, no meal plan (FROZEN, Sep 27, 2026)
Meal lines that match the user's own baseline are parsed on the phone; only unmatched lines can be sent, through the send preview, or entered by hand (frames 3n to 3p). A daily calorie and protein target is calculated on the phone from the goal and never falls below a safe floor. The app does not prescribe meals.
Consequence: amends D-006 job 2. The formula and the floor are open item O-9 and must be sourced before the meals phase.

## D-033 Visual how-to, bundled (FROZEN, Sep 27, 2026)
Every exercise can carry a demo (looping clip or image) stored with the app under `public/demos/` and referenced by path; nothing loads from another site. The text how-to stays underneath (frames 2d, 3b, 3c).
Consequence: supersedes D-018. Source and licensing of the media are open item O-6; until then the slot shows a placeholder.

## D-034 Visual direction 1b, light and dark (FROZEN, Sep 27, 2026)
The whole app uses the 1b "ink and paper" direction: warm paper ground, open lists on hairlines, heavier headline type, one deep-navy accent, with a derived dark palette. Token values are in PLAN section 12.
Consequence: replaces the v1 FitIndex-style direction. Each screen adopts the 1b layout in the phase that rebuilds it; Phase 6 swaps colour tokens only.

## D-035 Program schema version 2 (FROZEN, Sep 27, 2026)
Exercises gain optional `muscles`, `equipment`, `level` and `demo`; items gain optional `retiredFrom`. Import accepts schemaVersion 1 and 2 and stores 2; version 1 files need no changes.
Consequence: `docs/program.schema.json` v2; stored programs are upgraded when the database opens.

## D-036 Other people may use the app (FROZEN, Sep 27, 2026)
PLAN section 1's single-user scope is lifted: the app is built so a stranger can install it and use it with their own program and, optionally, their own key. Promotion to strangers waits on O-7.
Consequence: amends PLAN section 1. D-020 is unchanged: there is still no server and no account, and everyone brings their own key.

## D-037 Starter programs (FROZEN, Sep 28, 2026)
Three full-gym starter programs ship with the app under `public/templates/`: 3-day full body (beginner, 8 weeks), 4-day upper/lower (intermediate, 10 weeks), 5-day split (experienced, 12 weeks). Drafted by Claude and approved by Auggie without changes. Design rules, sources and the coverage matrix are in `docs/STARTER-PROGRAMS.md`: every major muscle group trained at least twice a week, about 10 weekly sets per group in the intermediate and experienced programs, heavier compound work there, 8 to 12 reps for beginners (ACSM position stands 2026 and 2009).
Consequence: resolves O-8. Onboarding suggests the 3-day program for New and the 4-day program for Experienced. A home-equipment version is backlog B-9. Exercise how-to text stays DEFAULT until O-6.

## D-038 byWeek overrides are closed (FROZEN, Sep 28, 2026)
An override may carry only `itemFields` properties; any other key is rejected by the schema. The same closed shape validates the `fields` of an AI update's overrides.
Rationale: found in Phase 6 verification. `itemFields` never closed its property list, so since Gate 2 an override, including one proposed by the model, could carry any key. The executor enforced the `retiredFrom` case in code; this closes the whole class in the contract.
Consequence: `docs/program.schema.json` corrected without a version change, because it only rejects keys that were never part of the format. Every stored and seed program must still validate; a file that fails is reported, never silently changed.

## D-039 Appearance: System, Light or Dark (FROZEN, Sep 28, 2026)
Settings gains an Appearance control with three choices: System (the default: follow the phone, as the app has since Phase 5), Light and Dark (override the phone for this app only). The choice is stored in `settings.appearance` and mirrored in `localStorage` only so the first paint uses the right colours before IndexedDB answers; IndexedDB stays the source of truth. The browser's `theme-color` follows the colours in use.
Rationale: stated by Auggie, Sep 28, 2026. Omitted from briefs v2.0 and v2.1 and from the design canvas; the gap was Claude's.
Consequence: frame 5c has no Appearance row; the Phase 11 Settings rebuild places it directly under Units.

## D-040 Units in Settings change what comes next, never what exists (FROZEN, Sep 28, 2026)
Onboarding step 6 promises "You can change this in Settings"; Settings now has the Units control. Changing it sets the unit for new programs, new items, goals and body weight. The current program's items keep the unit they carry, and logged sets are never converted (D-012).
Rationale: switching an existing program's items from lb to kg would make last week's "60" pre-fill as 60 kg. Converting a program is a separate, explicit action, not a side effect of a setting (backlog B-10).
Consequence: the Units row carries the line "Applies to new programs and goals. Your current program keeps its units."

## D-041 The not-advice banner stays off onboarding (FROZEN, Sep 28, 2026)
The per-load disclaimer banner (Phase 5) is not shown on `/welcome`, where step 3's safety notice already covers it. Everywhere else it behaves as before.

## D-042 Builder rules (FROZEN, Sep 28, 2026)
These make D-028 buildable; each protects logged history or the user's time.
1. Drafts. One draft at a time, saved to the `meta` store under `builderDraft` on every change, so it survives navigation and reload. Save or Discard clears it. The draft is exported with the rest of `meta`.
2. Ids. New items, sections and exercises get generated ids that cannot collide with any id the program has ever used. Existing ids are never renamed or reused.
3. History. An item "has history" when any stored session has an entry with its `itemId`. Removing an item without history deletes it. Removing an item with history retires it (frame 2i): `retiredFrom` is today, or tomorrow if a session today already logged it.
4. Swapping the exercise of an item with history retires that item and adds a new item with the new exercise in the same position, so last week's numbers are never shown for a different exercise. Without history, the swap edits the item in place.
5. Editing the current program: `startDate` is read-only, because changing it would renumber every week and move every `byWeek` override; length cannot go below the current week. Existing `byWeek` overrides are kept exactly; the item editor edits the base item and says how many later-week changes exist.
6. Starting a new program saves it and makes it active; the previous program and all its sessions stay stored and visible in Log.
7. Exercise library for pickers: the exercises of the three starter programs and of every stored program, de-duplicated by id. Filters (same muscles, beginner friendly, no equipment) use `muscles`, `equipment` and `level`; exercises without that metadata appear only when no filter is on. Users can create an exercise: name required; how-to, muscles, equipment and level optional.
8. Session length on day cards and in review uses the formula recorded in `docs/STARTER-PROGRAMS.md` and is labeled "about".
9. Saving an unchanged program writes back a program whose JSON is identical to what was loaded.
Consequence: frames 2a to 2j; onboarding step 4 shows "Build it with forms" again (the Phase 7 limit ends), and choosing a starter program in onboarding shows frame 2a before step 5.

## D-043 How AI changes are applied (FROZEN, Sep 28, 2026)
Both AI jobs return the D-025 patch shape; they differ in where changes land.
1. Update (D-027, whole patch). For week N, a change to an item on a day not yet started this week is written as a `byWeek` override keyed N; a change to an item on a day already started is keyed N+1, so it takes effect next week (frame 4f: "Push picks them up on Monday"). Overrides carry forward under D-023. This replaces D-027's rule that changes to started days are rejected.
2. Review (D-026, line by line). Accepted changes edit the base program, because a review changes the program itself, not one week of it.
3. In both, a `remove` of an item with history retires it (D-042 rule 3) instead of deleting it, with `retiredFrom` the first date the change applies; a swap of an item with history follows D-042 rule 4. An `add` goes into the base program.
4. Validation errors name the offending key and item (for example `/overrides/2/fields/foo: unknown field "foo" on item i014`).

## D-044 What each privacy level sends (FROZEN, Sep 28, 2026)
Makes D-031 exact. One function builds both the preview (frames 4h, 4i) and the request, so the preview is what is sent.
- Minimal: the program without its top-level `notes`; confirmed sets (weights, reps, seconds, distance, minutes) with dates and ids; the structured goal (types, targets, timeframe, start date), never `currentStats`; the user's rules text.
- Standard: Minimal plus experience level and "felt off" flags (the flags exist from Phase 10).
- Full: Standard plus current weight from `currentStats`; and, only when the user switches on "Include notes", session notes and the program's `notes`. Age range and sex are listed in frame 5e but nothing collects them yet (O-11), so they are not sent.
- Never, at any level: name, date of birth, body-stat history, the Profile screen's free label and value fields, the API key.
Consequence: the weekly update no longer sends Profile fields. Anything the model needs from them goes into the rules text.

## D-045 The existing meals call goes behind the preview now (FROZEN, Sep 28, 2026)
Until Phase 10 makes meals local-first (D-032), the Phase 4 meal-parse call stays, but it opens the send preview and is written to the sent log like every other call.

## D-046 Calorie and protein target (FROZEN, Sep 28, 2026)
Computed on the phone and never sent at any privacy level. Method and sources in `docs/TARGETS-AND-PROGRESSION.md` Part 1: Mifflin-St Jeor resting energy; activity factor 1.53, 1.76 or 2.25 (FAO/WHO/UNU 2004); minus 500 kcal/day for lose goals, no change otherwise (2013 AHA/ACC/TOS); never below 1,200 kcal/day for women or 1,500 for men (same guideline); protein 1.6 g/kg, or 2.0 g/kg for lose goals (ISSN 2017). Calories rounded to 10, protein to 5 g, labeled as an estimate.
Inputs: height, age and sex are added to the goal setter as optional fields, stored on the phone and never sent (approved by Auggie Sep 28, 2026). This is separate from O-11: the Full privacy level still does not send them. Without all three, Meals shows the protein target only.

## D-047 Progression suggestion (FROZEN, Sep 28, 2026)
The deck suggests more weight only after two consecutive sessions of an item in which every working set reached `repMax` at the same weight (ACSM 2009: increase 2 to 10% after one to two reps over target on two consecutive sessions; the threshold is Auggie's correction). Size 5% for exercises with legs, glutes, back or chest among their muscles on a barbell, machine or cable, 2.5% otherwise and when metadata is missing. Rounded to the nearest equipment step (barbell, machine, cable 2.5 kg or 5 lb; dumbbell 2 kg or 5 lb), never less than one step (nearest chosen by Auggie Sep 28, 2026). If one step exceeds 10% of the load, the chip suggests more reps instead. An item may carry `progression` { sessions, percent, step } to replace the defaults. The chip never applies itself.
Consequence: schema v2 gains the optional item field `progression` (not overridable in `byWeek`). Frame 3b's copy becomes "Try <weight>, you hit <sets> × <reps> in your last <n> sessions."

## D-048 Felt off flags (FROZEN, Sep 28, 2026)
Each deck exercise can be marked Too easy, Too hard, or Discomfort (skipped), stored on the session entry as `feltOff`. Discomfort also marks the entry skipped. Flags are sent at Standard and Full (D-044) as item id and flag only.

## D-049 Meals on the phone: baseline foods and line grammar (FROZEN, Sep 28, 2026)
Makes D-032 and D-046 buildable.
1. Baseline foods. Settings holds a list of the user's own foods, each with a name, kcal and optional protein in grams (`settings.mealFoods`). The existing free-text baseline stays and is sent only with lines that need the model.
2. Line grammar, matched on the phone, case-insensitive with spaces collapsed: `<food>` or `BASE <food>` counts that food once; `ADD <food>` or `ADD <food> <n>` counts it n times; `SKIP <food>` subtracts it once. `<food>` must equal a baseline food's name. Any other line is unmatched.
3. Unmatched lines are listed under Needs AI, with "Send these lines" (the preview shows only those lines, the foods and the free-text baseline) or "Enter kcal myself". Each line's result records its source: phone, ai or manual. Today's total excludes lines still waiting.
4. Target details. The deficit and the 2.0 g/kg protein apply when the main goal (rank 1) is lose weight or lose body fat. Weight, height, age, sex and activity come from the goal setter's current stats; with no weight there is no target, and with weight but not all of height, age, sex and activity there is a protein target only.

## D-050 Release polish (FROZEN, Sep 28, 2026)
Closes the items parked during Phases 6 to 10B.
1. Sent log status. Entries keep being written before a call is sent (nothing is ever sent unlogged) and gain `status: 'sent' | 'failed'`, updated when the call returns; a failed row says so and shows the error. Entries without a status read as sent.
2. Backup reminder. When the setting is on and the last export is more than 30 days old (or there never was one), Today shows one dismissible note linking to Export. No notifications. Dismissing hides it until the next 30-day mark.
3. Privacy copy. Under current stats: weight "Sent only at the Full privacy level"; height, age, sex and activity "Never sent".
4. The privacy page (frame 5i) and the safety notice (frame 5j) are reachable from Settings, as D-029 requires; neither was built before this release. The safety notice text is the D-029 wording, unchanged.
5. The app shows its version in Settings (frame 5d) from `package.json`, set to 2.0.0 for this release.
6. The app icon is not redesigned in this release; it becomes backlog B-11, because no design exists for it.

## D-051 Weight and reps in separate boxes (FROZEN, Sep 28, 2026)
Found by Auggie on his iPhone after Phase 11: the single free-text set field rejects "5, 135", "135, 5", "5 reps 135 lbs" and "135 lbs", and on a first session (no last-week reference) even a bare "5". Reproduced against `parseSet` on `main` (f0dd5d2). The grammar only accepts weight first with a connector word ("135 x 5", "135 for 5").
Decision (Auggie's): every `load_reps` set row has two boxes, Weight (decimal keypad, with the unit shown) and Reps (number keypad). Last week's values show as placeholders; the progression chip fills Weight. A set saves when Reps holds a whole number of at least 1 and Weight holds a number of at least 0, typed or taken from its visible placeholder; an invalid box shows its error inline and nothing is saved. Other item types keep one box, now with a number keypad and the unit named: reps for `bodyweight_reps`, seconds for `timed_hold`, meters for `distance`, minutes for `cardio_block`. Number words from keyboard dictation ("sixty two point five") still read correctly in any box.
Consequence: supersedes D-011's single field and the dictation hint (frame 3b's "say 62.5 for 8"), which is removed. `parseSet` stays for "same" and for number words; its grammar no longer faces the user.

## D-052 No program after onboarding shows empty states (FROZEN, Sep 28, 2026; records Phase 11 behaviour)
After onboarding, a missing program opens the tabs with the empty states of frames 7a and 7c instead of redirecting to Import; screens that need a program go to Today. Import stays reachable from Settings and Start a new program. Before onboarding, the app still goes to `/welcome`.
Rationale: an executor judgment call in Phase 11, accepted after verification because it follows the design. Amends PLAN 7.5.
