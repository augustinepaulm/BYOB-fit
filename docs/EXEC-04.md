# EXEC-04: Model, Meals, Profile, Settings, verify (v1.0, Sep 14, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. No new dependencies. Do not restyle, improve, or extend scope. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Read `docs/PLAN.md` v1.4, `docs/DECISIONS.md` (D-004 to D-006, D-016, D-025), and the Week (Build next week states), Meals, Profile and Settings screens in `design/BYOB-fit_Design.html` before writing code.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch. `git checkout main && git pull && git checkout -b phase4`. Write `docs/EXEC-04.md` from the text the owner pasted and confirm its md5 matches the value the owner gives you; STOP if not. Commit it: `Contracts: EXEC-04`.

2. Carry-overs from Phase 3.
   a. Parser: on `load_reps` a bare number is reps; weight is inherited from the row's pre-fill (last-week reference, or the nearest confirmed set above it in this session); flag only when no weight is available. Update tests.
   b. A rest day whose daily items are all checked reads Done on Today and Week.
   c. Delete `src/App.css` and its import.
   d. `npm run verify`: runs lint, tests, build, then prints `md5` of every file in `docs/` and `public/sample-program.json`, then `git ls-files seed/` (must print only `seed/README.md`), and exits non-zero on any failure. Add it to `package.json` scripts.

3. Settings screen (`/settings`), from the design. Fields: API key (masked, stored only in the `settings` store; never logged, never exported), model string (default `claude-sonnet-5`), a Test button that sends a minimal message and shows success or the error text, a multi-line "Reprogramming rules" field, a multi-line "Meal baseline" field, Export data (task 8), Import program (routes to the existing Import screen), Reset app (confirmation dialog, clears every store). A plain-language note as in the design brief: key and data stay on this phone; once a week the log is sent to the model.

4. API client, `src/lib/anthropic.ts`. POST `https://api.anthropic.com/v1/messages` with headers `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`, and `anthropic-dangerous-direct-browser-access: true`. Body: `model`, `max_tokens`, `system`, `messages`. Timeouts and network errors surface as readable messages. No retries that could double-spend. Unit-test the request builder, not the network.

5. Reprogramming (D-025). On the Week screen, "Build next week" becomes active when the current program week has at least one finished session. It sends: the active program JSON; this week's sessions (compact: date, dayId, per entry exerciseId as performed, confirmed sets, notes, checks); the Profile fields; the rules text from Settings; the target week number N+1. System prompt instructs the model to return ONLY JSON of this shape:
   ```
   { "week": N+1,
     "overrides": [ { "itemId": string, "fields": ItemFields, "reason": string } ],
     "add":       [ { "dayId": string, "sectionId": string, "afterItemId": string|null, "item": Item, "reason": string } ],
     "remove":    [ { "itemId": string, "reason": string } ],
     "notes": string }
   ```
   The app strips code fences if present, parses, and validates: every referenced id exists; every `fields` object satisfies `itemFields` in the schema; added items satisfy `item` and reference known exercises (an added item may include a new `exercise` object, which is added to `exercises` on approval). On invalid output, show the validation errors and a Retry button; never apply. On valid output, render the diff view by day: for each override, the item name with old value → new value per changed field and the reason; adds and removes listed with reasons; `notes` at the top. Approve writes: each override as `byWeek[String(N+1)]` on its item (merged over any existing key N+1), adds inserted, removes applied, the program saved, and a `reprogram` record kept in a new `reprograms` store (week, timestamp, model, the raw response, approved: true). Discard keeps nothing but the record with approved: false. Loading and error states per the design.

6. Meals screen (`/meals`), from the design. One entry per day (date picker defaults to today), a multi-line text area for lines in the DFS-plus-delta convention, a Parse button. Parse sends the lines plus the "Meal baseline" text from Settings to the model with a system prompt asking for ONLY JSON: `{ "kcal": number, "proteinG": number, "items": [ { "line": string, "kcal": number, "proteinG": number } ] }`. Show the day totals in the two metric cards, the per-line breakdown, and keep the raw text editable; re-parsing replaces the parsed result. Week totals card sums the seven days of the current program week. Persist in the `meals` store as `MealDay`.

7. Profile screen (`/profile`), from the design: user-entered label/value fields (add, edit, remove), stored in the `profile` store, the gear to Settings. No computed metrics.

8. Export and import of data. Export: one JSON file containing programs, sessions, weekPlans, meals, profile, reprograms and settings WITHOUT the API key, offered through the Web Share API when available, else a download. Import data (on Settings, separate from Import program): reads such a file, validates the shape, and replaces the stores after a confirmation dialog.

9. Placeholder cleanup: no screen shows "Coming in Phase N" any more.

10. Checks. `npm run verify` passes. `npm run dev`, at 390 px: Settings saves a fake key and the Test button shows the API's authentication error text (proof the request reaches Anthropic and the error path renders); a Meals day with two lines shows the loading state and then either a parsed result or the same auth error; Build next week shows the loading state and then the auth error; Export produces a file and Import data restores it. Do not use a real key.

11. Commit and push. `git status` shows nothing under `seed/`. Commit on `phase4` as `Phase 4: model, meals, profile, settings, verify`, `git push -u origin phase4`. No merge, no pull request.

## Report

One line per task, 1 to 11, ending PASS or FAIL, with evidence for 1 (md5), 2d and 10 (the verify output tail and the walkthrough observations), 11 (push output). List every decision a task did not cover: the exact system prompts you wrote for tasks 5 and 6 (quote them in full), how you compact sessions, how the diff view renders per-side and byWeek items, anything the design left ambiguous. Finish with `git log --oneline -5` and `git status`.
