# EXEC-11.1: Weight and reps in separate boxes (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. This is a small change fixing a live defect: implement the numbered tasks exactly, touch only what they name, no new dependencies. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-011, D-047 and D-051 after task 2 has placed it. Keep the 1b look of the deck's set rows (frame 3b): same row height, type and tokens; the second box sits in the same row.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.1`. Write `docs/EXEC-11.1.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` 994e29d71698f3dfca9b650460a32a19, `docs/DECISIONS.md` 061f058e03ce0c58b610c19d86438650, `docs/EXEC-11.md` ea6898335ca531bb76e71f3eee3b0ac9; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` bdc0f0571513f47c71e987c78f3e0c40, `docs/DECISIONS.md` 7590decf64ebffd2a98f62ca37e11941. Re-hash both. Commit with `docs/EXEC-11.1.md`: `Contracts: plan v1.13, D-051 and D-052, EXEC-11.1`.

3. Reproduce first: before changing anything, run the current `parseSet` with `type: 'load_reps'` and no reference on "5, 135", "135, 5", "5 reps 135 lbs", "135 lbs" and "5", and paste the results in the report (all five are rejected today). After task 5, a test enters the same values through the two boxes (weight 135 with reps 5, in each written form) and asserts each saves as 135 × 5.

4. Box parsing, pure and unit-tested in `src/lib/setBoxes.ts`: `readWeight(text)` and `readReps(text)` accept digits and, through `normaliseNumbers`, number words; each strips a trailing unit word (kg, kgs, lb, lbs, pound, pounds; rep, reps). Weight: a number of at least 0, decimals allowed, comma accepted as decimal separator only when it is the only separator ("62,5"). Reps: a whole number of at least 1. Anything else is an error with a short message. Tests include "135", "135 lbs", "62.5", "62,5", "sixty two point five", "0", "5", "5 reps", "five", and rejects for "", "-5", "5.5" reps, "abc".

5. Deck set rows (D-051).
   - `load_reps`: two boxes in one row: Weight with the item's unit after it (`inputMode="decimal"`) and Reps (`inputMode="numeric"`). Placeholders: last week's weight and reps for that set, else the prescription (for example the rep range's top). The progression chip fills Weight in every open row, as today.
   - Saving: the tick, Enter or Next on the Reps box saves the set when Reps is valid and Weight is valid, either typed or taken from its visible placeholder. With no weight placeholder and an empty Weight box, the Weight box shows "Enter a weight" and nothing is saved. Invalid input shows its error under the box that caused it, keeps what was typed, and saves nothing. No `raw` rows are written from this path.
   - Editing a saved set shows its weight and reps in the two boxes.
   - Other types: one box with `inputMode="numeric"` (decimal for distance) and the unit named after it: reps, s, m, min.
   - "Same" copies the previous set into both boxes and saves, as today.
   - Remove the dictation hint and its `meta.dictationHintCount` use (D-051).

6. Existing data: sets saved before this change, including any flagged `raw` rows, display unchanged, and a raw row can be corrected by entering values in the boxes.

7. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Screenshots at 390 px of a load row empty, filled, with a Weight error, and a timed-hold row, light and dark, under `phase11.1-screens/`.
   c. First session with no history (fresh profile, 3-day starter): type 135 and 5 and tick: the set is 135 × 5 in the item's unit. Type only 5 in Reps: "Enter a weight" shows and nothing saves.
   d. Second session: placeholders show last week's values; typing only Reps saves with the placeholder weight.
   e. Keyboard: on Chrome's iPhone emulation, report the `inputMode` of each box; state that the real keypad needs Auggie's phone.
   f. `git diff --stat main -- src` lists only files these tasks required.

8. Push `small-11.1` and open a pull request titled `Small change 11.1: weight and reps boxes`. Do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
