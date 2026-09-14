# EXEC-03: Deck, logging, Log screen (v1.0, Sep 14, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. Do not restyle, improve, add dependencies, or extend scope. Capture real command output where a task says "must print". If a step would delete files, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Read `docs/PLAN.md` (v1.4) section 5, `docs/DECISIONS.md` D-008 to D-014 and D-022 to D-024, and the Deck, Today and Log screens in `design/BYOB-fit_Design.html` before writing code.

Working directory: `~/Code/BYOB-fit`. No new dependencies. Inline SVG for the sparkline.

## Tasks

1. Branch and contracts. `git checkout main && git pull && git checkout -b phase3`. The owner has placed updated contract files; confirm `md5 docs/PLAN.md docs/DECISIONS.md docs/program.schema.json docs/EXEC-02.md docs/EXEC-03.md` prints `e1494884ab2ff9f3317a68252097d3e3`, `671b6dbcf369ebb7763261b18f1b75ab`, `99ca7724a761ea782fa106d12b6f15e5`, `da3fa48a359e09cce1487cb8241ddd13`, and the EXEC-03 value the owner gives you, in that order; if any differ, STOP. Commit them: `Contracts: plan v1.4, D-022 to D-024, schema wording, EXEC-02/03`.

2. Cumulative byWeek (D-023). In `src/lib/program.ts`, `resolveItem` folds every key <= week in ascending order on top of the base. Replace the test that pinned greatest-key-wins; add a test where a lower key's field survives a higher key that does not mention it (the walk-jog case).

3. HashRouter (D-022). Switch the router; all routes work after a hard refresh at `/BYOB-fit/#/week`. Any internal link or redirect that assumed path routing is updated.

4. Sunday rule. `importProgram` rejects a `startDate` that is not a Sunday with a clear message naming the weekday it found. Test it.

5. Rest days render the daily section as check-off items under the rest-day header instead of the "Nothing scheduled" copy alone.

6. Session store and rules. One session per (date, dayId). Today's Start creates it; Resume reopens it. Every set confirmation, check, note and alternate choice writes to IndexedDB immediately (no unsaved state; a killed tab loses nothing). `Entry.exerciseId` records the exercise as performed. Finish sets `endedAt`. A session with `endedAt` is done; without it and with any entry, partial.

7. Set parser, `src/lib/parseSet.ts`, with `src/lib/parseSet.test.ts` (at least 15 cases). Grammar from PLAN section 5: `<n> (for|x|by|×) <n>` → weight and reps; `<n> (s|sec|seconds)` → seconds; `<n> (m|meters|metres)` → distance; `<n> (min|minutes)` → minutes; `same` → copy the reference set; `bodyweight` or `bw` → weight 0. Normalise spoken numbers before matching: "twenty two point five for eight" → 22.5 for 8; handle "and a half", "point", hyphenated tens, "x" spoken as "by" or "times". For `bodyweight_reps` a bare number is reps; for `timed_hold` a bare number is seconds; for `distance` a bare number is metres; for `cardio_block` a bare number is minutes; for `load_reps` a bare number is ambiguous and stays unparsed. Result: `{ ok: true, fields }` or `{ ok: false, raw }`; never a silent zero.

8. Last-week reference. For each logged item, find the most recent finished session for the same `dayId` that contains an entry with the same `exerciseId` (fall back to the most recent finished session containing that exercise on any day); use its set N as the reference for set N. Reference shown muted per row and used to pre-fill; if none, pre-fill from the prescription (`repMin`, no weight) and mark the row as "first time".

9. Deck screen (`/deck`), from the design. Header: section title, "item N of M" across the whole session, thin progress bar, rest timer (starts counting down from the item's `restSec` when a set is confirmed; timestamp-based so backgrounding does not drift; shows mm:ss; silent), End button (confirms, then Finish flow). Active tile: exercise name, index marker if `index`, alternate button if `alternateExerciseId` ("Use <alternate name> instead", one tap swaps for this session and records it), prescription line (sets, reps or hold or distance or minutes, tempo, rest, RPE), cue in muted text, rows per set (per-side items show L and R rows), each row: set number, reference in muted text, ONE text input (`type="text"`, default keyboard so the iOS dictation key is available; not `inputMode="numeric"`), parsed result shown beside the field, states pending / confirmed / flagged ("Couldn't read this, tap to fix", raw kept). Done confirms all pending rows using their pre-fill and advances; Back returns without losing data. "How to perform" collapsed disclosure showing `exercise.howTo`. Below: next item card (name and prescription) and a dimmer third card (name only). On focus, the active row scrolls into the top half of the viewport.

10. Type variants of the tile: `load_reps` (weight and reps, unit shown), `bodyweight_reps` (reps only), `timed_hold` (seconds with a per-row start/stop timer that fills the field on stop), `distance` (metres), `cardio_block` (single minutes field, a note field, a running timer), `check` (one large checkbox, no rows). Items where `isLogged` is false render as check tiles even inside logged sections, and vice versa.

11. Session summary, from the design: total sets confirmed, volume shown per unit with no conversion ("lb volume" and "kg volume" lines, omit a line if zero), duration, items skipped (unconfirmed logged items and unchecked check items), swap note if the day was swapped, Finish button. After Finish, Today shows a one-line done summary and a "View log" link; Start is replaced by "Done today".

12. Week screen: done/partial/not-started from sessions.

13. Log screen (`/log`), from the design: searchable exercise list (exercises with at least one logged set first, then the rest), an "Index lifts" toggle that filters to `index` items. Detail: table of sessions (date, sets as "60 × 8, 60 × 8, 60 × 7"), best set (highest weight, ties by reps; for holds longest; for distance longest), sparkline of top-set weight over time as inline SVG.

14. Checks. `npm run lint` zero warnings, `npx vitest run` all passing, `npm run build` exit 0. `npm run dev`, load the sample at 390 px, run a full Monday session through the deck with typed entries including one flagged row, finish, confirm Today, Week and Log reflect it. Capture the evidence lines.

15. Commit and push. `git status` must show nothing under `seed/`. Commit on `phase3` as `Phase 3: deck, logging, Log screen`, `git push -u origin phase3`. Do not merge. Do not open a pull request.

## Report

One line per task, 1 to 15, ending PASS or FAIL, with evidence for 1 (five md5 values), 2 and 7 (vitest summary), 14 (lint, test, build tails and what the dev-server walkthrough showed) and 15 (push output). Then list every decision a task did not cover: parser edge cases you chose, how the reference lookup handles per-side rows, any design ambiguity and how you resolved it. Finish with `git log --oneline -5` and `git status`.
