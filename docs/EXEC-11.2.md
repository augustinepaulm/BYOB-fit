# EXEC-11.2: Pre-fills never become data (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. This is a small change fixing a live defect: implement the numbered tasks exactly, touch only what they name, no new dependencies. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-047, D-051 and D-053 after task 2 has placed it.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.2`. `git log --oneline -1` must show `70109a3`; STOP if not. Write `docs/EXEC-11.2.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` bdc0f0571513f47c71e987c78f3e0c40, `docs/DECISIONS.md` 7590decf64ebffd2a98f62ca37e11941, `docs/EXEC-11.1.md` 3b603a8eae7924557cc765e2de0ddf2c; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` dd223a7e494c71984658e3f8f243156e, `docs/DECISIONS.md` fe951434a02cbdd3283f64c8e5105149. Re-hash both. Commit with `docs/EXEC-11.2.md`: `Contracts: plan v1.14, D-053, EXEC-11.2`.

3. Reproduce first, on the unchanged code, in a test or a scripted browser run, and paste the result in the report: fresh profile, 3-day starter, first session, Goblet squat: type weight 135 and reps 5 in set 1, tick, then tap Done. Expected today, from reading the code (not yet run): sets 2 and 3 are saved as 135 × 12, the rep-range top. If the unchanged code does not save them, STOP and report what it does. After task 4 the same steps must leave sets 2 and 3 empty.

4. The fix (D-053), in `src/screens/DeckScreen.tsx` and, where it belongs, `src/lib/setBoxes.ts`:
   - Done saves an untouched row only when last week's reference exists for that exact row, using that reference's weight and reps. A row with no reference stays empty. Remove every path that saves an untouched row from `prescriptionPrefill` or from `nearestWeightAbove`.
   - With no last-week value, the Reps placeholder shows the rep range (for example "8–12", or the single number when `repMin` equals `repMax`) and is not confirmable: the tick with an empty Reps box shows "Enter reps" and saves nothing. With a last-week value, the tick on an untouched row still confirms it, as today.
   - The Weight placeholder may still come from the set above; it is used only when Reps is typed.
   - One-box types follow the same rule: an untouched box saves only from last week's reference.

5. Tests: the task 3 case; second session with last week's values, Done on untouched rows saves exactly those values; first session, tick with Reps empty shows "Enter reps" and saves nothing; first session, typed Reps with the Weight placeholder from the set above saves; `suggestProgression` returns `null` for an item whose first session was completed with Done after one typed set.

6. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Re-run the EXEC-11.1 checks 7c and 7d in the browser, plus: log set 1 on a first-session exercise, tap Done, then open Log: only set 1 is recorded.
   c. Screenshot of a first-session load row showing the "8–12" placeholder, light and dark, under `phase11.2-screens/`.
   d. `git diff --stat main -- src`, including new files, lists only files these tasks required.

7. Push `small-11.2` and open the pull request **as a draft**: `gh pr create --draft --title "Small change 11.2: pre-fills never become data"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
