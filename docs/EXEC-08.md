# EXEC-08: Program builder (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. No new dependencies. Do not restyle existing screens, improve, or extend scope. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/PLAN.md` v1.8 sections 5, 6 (Phase 8) and 12, and `docs/DECISIONS.md` D-023, D-028, D-033, D-035, D-037, D-038 and D-042, after task 2 has placed them. Layout and copy come from `design/BYOB-fit_v2_design.dc.html`, frames 1d, 2a to 2j and their `-dark` versions; copy UI text exactly as in those frames.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase8`. Write `docs/EXEC-08.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` f33238185213b4260a22b02ffa0cafb6, `docs/DECISIONS.md` d4e388a2f76f35888a579531e382994c, `docs/EXEC-07.1.md` 0833be451879134705a7f37a0db19eb2, `docs/program.schema.json` e3ae437fd83a49e9a21ac2a39d38966b; STOP if any differ.

2. Place by hash from `~/Downloads` (same method as before): `docs/PLAN.md` 4247c32669bb1d42c5b99b51938711cc, `docs/DECISIONS.md` 1035cf68d7b7cd3ad1e2792ab3b10096. Re-hash both. Commit with `docs/EXEC-08.md`: `Contracts: plan v1.8, D-042, EXEC-08`.

3. Builder logic as pure, unit-tested functions in `src/lib/builder.ts` (D-042):
   - `newId(program, prefix)`: an id not used anywhere in the program (items, sections, days, exercises, including inside `byWeek`).
   - `itemsWithHistory(sessions)`: the set of `itemId`s that appear in any session entry.
   - `removeItem(draft, itemId, history, today, loggedToday)`: deletes an item without history; retires one with history, with `retiredFrom` today, or tomorrow when `loggedToday` holds it.
   - `swapExercise(draft, itemId, exerciseId, history, today, loggedToday)`: edits in place without history; with history, retires the item and inserts a new item with the new exercise, same prescription, directly after it.
   - `sessionMinutes(day)`: the formula behind `docs/STARTER-PROGRAMS.md`, exactly: for each item, a `cardio_block` adds its `minutes`; any other item adds `sets × (w × s + r) + 1`, where `w` is `holdSec / 60` if `holdSec` is set, else 40/60; `s` is 2 when `perSide`, else 1; `r` is `restSec / 60`, or 1 when `restSec` is absent; a missing `sets` counts as 1. Round the day's total to the nearest 5. It must reproduce the stored `durationMin` of every training day in all three starter programs (12 days; test each).
   - `exerciseLibrary(templates, programs)`: exercises from the starter programs and every stored program, de-duplicated by id; `filterLibrary(lib, { sameMusclesAs?, beginner?, noEquipment?, query? })`, where exercises lacking the needed metadata appear only when no filter is on.
   - `reviewChecks(draft)`: the three checks in frame 2j, each pass or fail with the failing day or field. Only schema-valid drafts can be saved; validate with the importer's validator.
   - `roundTrip`: loading a program into a draft and saving it unchanged returns JSON identical to the input. Test with the sample (which has a `byWeek` override and an alternate) and all three starter programs.

4. Draft store. The draft lives in `meta` under `builderDraft` (JSON: `{ mode: 'new' | 'edit', program, step, updatedAt }`), written on every change. Opening the builder with a draft present resumes it. Save validates, writes the program, clears the draft and removes the Draft badge. A "Discard draft" action with confirmation clears it.

5. Forms path, frames 2e to 2j. Four steps: Settings, Days, Exercises, Review, with the step bar and Draft badge from the frames.
   - 2e Program name, length in weeks (1 to 52), start date as a Sunday with "Ends <Saturday>". When editing the current program, the start date is shown read-only and length cannot go below the current week (D-042 rule 5).
   - 2f Seven days: tap to edit, mark rest or training, rename, set focus, mark two days as swappable with each other (`swappableWith` both ways), reorder by drag plus Move up and Move down. Reordering permutes `order`; day ids stay with their content.
   - 2g Day editor: sections in the fixed kind order; empty kinds collapse to "+ Kind" chips; add, reorder (drag plus Move up and Move down) and open items.
   - 2h Item editor: exercise with Change (opens the picker), type, and only the fields that type uses; inline errors on the field that caused them (for example repMax below repMin: "The second number must be higher"); "Remove from this day" follows `removeItem` and shows frame 2i when history exists. When the item has `byWeek` overrides, show "Changes in later weeks: N. Those stay as they are." and never edit them.
   - 2j Review: name, date range, counts, the three checks, and each day's item count; Save program only when every check passes.

6. Starter path, frames 2a to 2d. After a starter program is chosen in onboarding step 4 (1e), show 2a: "Use this program" continues to onboarding step 5; "Change something first" opens 2b on that program (as a draft in onboarding state, not yet saved), and Done returns to 2a. 2b lists each day's exercises with a demo placeholder and Swap. Swap opens 2c: search plus the filter chips Same muscles (on), Beginner friendly (on when onboarding answered New), No equipment (off). Tapping an exercise anywhere opens 2d: demo placeholder marked "demo", name, muscles · equipment · level, and the how-to split into numbered sentences.

7. Custom exercise. In the picker, "Create an exercise": name required; how-to, muscles, equipment and level optional, using the schema's enums. It gets an id from `newId`. No demo.

8. Entry points.
   - Onboarding step 4 (1d): show "Build it with forms" again with Continue, as in the frame. It opens the forms path in `new` mode; Save returns to onboarding step 5 with that program chosen. The Phase 7 limit in PLAN ends here.
   - Profile: a "Program" row under the Goal row, showing the active program's name and "Week N of M", with "Edit program" (the forms path in `edit` mode on the active program) and "Start a new program" (choose a starter program, blank, or import; a new program becomes active after Save, and the previous one and its sessions stay stored, D-042 rule 6). Nothing else on Profile changes.
   - The existing `/build` route (weekly AI update) is untouched.

9. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Screenshots at 390 px of frames 1d, 2a to 2j, light and dark, named by frame, under `phase8-screens/`. State any visible difference from the frame.
   c. Runs on a fresh profile: (1) onboarding, "Build it with forms", build a 3-day program with one item of each type, hit and fix a repMin/repMax error, Save, finish onboarding: Today shows it. (2) Onboarding, pick the 3-day starter, "Change something first", swap goblet squat for leg press, Done, Use this program: Today shows leg press. (3) Leave the builder mid-way, reload: the draft resumes; Discard clears it.
   d. Runs on an existing database from `main` with the sample loaded and sets logged on two items: open Edit program and Save unchanged: the stored program JSON is identical before and after. Remove one logged item: it is retired, gone from today onward (or from tomorrow if logged today), and its history is still in Log. Swap the exercise of the other logged item: a new item appears after it, and last week's numbers show only on the old one. Change sets on a third item: saved, and its `byWeek` overrides untouched.
   e. Start a new program from Profile: it becomes active; the old program's sessions still show in Log.
   f. `git diff --stat main -- src` lists only files these tasks required.

10. Push `phase8` and open a pull request titled `Phase 8: program builder`. Do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
