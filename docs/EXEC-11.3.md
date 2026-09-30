# EXEC-11.3: Set boxes and the iOS keyboard (v1.0, Sep 29, 2026)

You are the execution pipeline for BYOB-fit. This is a small change fixing three live defects: implement the numbered tasks exactly, touch only what they name, no new dependencies in `package.json`. A throwaway browser script outside `src/` is allowed and is not committed. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-051, D-053 and D-054 after task 2 has placed it.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.3`. `git log --oneline -1` must show `ccd5696`; STOP if not. Write `docs/EXEC-11.3.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` dd223a7e494c71984658e3f8f243156e, `docs/DECISIONS.md` fe951434a02cbdd3283f64c8e5105149, `docs/EXEC-11.2.md` 6f42111278e61c51897d40f167889cd6; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` aae04a41c62e9c27c6f2d5af964f6045, `docs/DECISIONS.md` aca0b0b46aa910191bfa33762837a418. Re-hash both. Commit with `docs/EXEC-11.3.md`: `Contracts: plan v1.15, D-054 to D-058, EXEC-11.3`.

3. Reproduce first, on the unchanged code, in a scripted browser run in both WebKit and Chromium, and paste the numbers in the report. Seed a fresh profile with a program and a first session (no earlier sessions), at viewport widths 375, 390, 402 and 440 px:
   a. `public/sample-program.json` on a Friday, item `s035` (Face pull, 15–20); and `public/templates/starter-4day-upper-lower.json` on a Friday, item `i025` (split squat, per side, 8–10).
   b. For the first Reps box of each: the text space (`clientWidth` minus horizontal padding) and the width of its placeholder in the input's computed font (canvas `measureText`).
   Expected, measured in chat in Chromium with a fallback font: text space 64 px at 375, 38 at 390, 44 at 402, 58 at 440; "15–20" about 42 px. If WebKit shows no clipping at 390, STOP and report both sets of numbers.

4. D-054 rule 1, in `src/screens/DeckScreen.tsx`: every set box and the cardio minutes box gets `name` equal to its `id` (give the cardio box a neutral id, for example `box-cardio-min`), `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, `spellCheck={false}`. Keep `type="text"` and the existing `inputMode` values. The session note field is free text and keeps its current attributes. Do not use any `autocomplete` value that names another purpose.

5. D-054 rules 2 and 3.
   - Remove the immediate `scrollIntoTopHalf` call on focus. On focus of any set box: if `window.visualViewport` exists, wait for its next `resize` event or 350 ms, whichever comes first; then scroll that set's row container (not the input) so its centre sits at the centre of the visual viewport (`visualViewport.height` and `offsetTop`, not `innerHeight`). The same happens when focus moves between boxes with the keyboard's arrows. Keep the demo collapse on focus.
   - While any set box has focus, `.dk-foot` is not sticky (normal flow). It becomes sticky again on blur, when no box has focus.

6. D-054 rule 4: while a set box has focus, show a label pinned to the top of the visual viewport naming it: `Set <n> · weight` or `Set <n> · reps` (one-box types: `Set <n> · seconds|meters|minutes|reps`), with ` L` or ` R` after the number on per-side rows. It uses existing 1b tokens, reads correctly in light and dark, and is hidden when no box has focus. It must not cover the focused row after task 5's scroll.

7. D-054 rule 5: render the last-week cell (`.dk-set__ref`) for a row only when `exactReference(row)` returns a value. Otherwise render nothing in its place, so the boxes take the width. Leave the existing `max-width: 379px` rule as it is.

8. Tests: a row with last week's value for the same row renders the cell; a first-session row does not; a per-side row whose other side has last week's value but not this side does not; every set box and the cardio box carry the five attributes of task 4.

9. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Task 3 re-run after the change, WebKit and Chromium, all four widths, plus 393, 414, 420 and 430 px: for both placeholders, placeholder width is at most the text space. Paste the table.
   c. Regression, scripted: the EXEC-11.2 check (first session, log set 1, Done: only set 1 is recorded); and edit in an open session (save 100 × 8 on set 1, retype 105 and tick, Done, Back, change reps to 7 and tick: stored 105 × 7).
   d. Screenshots at 390 px, light and dark, under `phase11.3-screens/`: a first-session Face pull row with "15–20"; a second-session row showing the last-week cell; a focused box with the task 6 label.
   e. `git diff --stat main -- src`, including new files, lists only files these tasks required.

10. Push `small-11.3` and open the pull request **as a draft**: `gh pr create --draft --title "Small change 11.3: set boxes and the iOS keyboard"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
