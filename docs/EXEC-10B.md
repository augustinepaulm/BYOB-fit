# EXEC-10B: Meals and targets (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. No new dependencies. Do not change screens outside this phase, improve, or extend scope. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/PLAN.md` v1.11 sections 5 and 6 (Phase 10B), `docs/DECISIONS.md` D-032, D-044, D-045, D-046 and D-049, and `docs/TARGETS-AND-PROGRESSION.md` Part 1, after task 2 has placed them. Layout and copy come from `design/BYOB-fit_v2_design.dc.html`, frames 3n to 3p and 5a with their `-dark` versions; copy UI text exactly, except where this prompt changes it.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase10b`. Write `docs/EXEC-10B.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` c731c02451632928980548aa0bd5364c, `docs/DECISIONS.md` 3a5ac7dda568a6c3dd6d5f5d6b2b0368, `docs/EXEC-10A.md` 0ce9f9998e3cd4b668f19519a99bfaab; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` 22d6bafc7564a15b0dcfa0e0ab0c01f3, `docs/DECISIONS.md` 91936ce8414631a22d5e7d410d63372d. Re-hash both. Commit with `docs/EXEC-10B.md`: `Contracts: plan v1.11, D-049, EXEC-10B`.

3. Phase 10A fix, its own commit `Fix: Log names from the exercise library`. Log's exercise names come from stored programs first, then the starter programs' exercise library (the same source as the swap picker), then the id as a last resort. Test: a session entry whose `exerciseId` exists only in a starter program shows its name.

4. Types. `Settings.mealFoods?: { name, kcal, proteinG? }[]`. Each parsed meal line gains optional `source: 'phone' | 'ai' | 'manual'`; a missing source reads as `ai`. `Goals.currentStats` gains `heightCm?`, `age?`, `sex?: 'male' | 'female'`, `activity?: 'sitting' | 'active' | 'very_active'`. The export envelope carries them unchanged; no version change.

5. Line grammar (D-049 rule 2), pure and unit-tested in `src/lib/mealLocal.ts`: `matchLine(line, foods)` returns `{ kcal, proteinG }` or `null`. Case-insensitive, spaces collapsed. `<food>` and `BASE <food>` count once; `ADD <food>` once and `ADD <food> <n>` n times (n a positive number, decimals allowed); `SKIP <food>` subtracts once. Tests: each form; an unknown food; `ADD` with a zero, negative or non-numeric count (unmatched); a food whose name itself ends in a number (`protein bar 2` as a name) matched by its full name first.

6. Targets (D-046, D-049 rule 4), pure and unit-tested in `src/lib/targets.ts`: `computeTargets(goals)` returns `{ kcal?, proteinG?, floorApplied }`. Convert lb to kg (1 lb = 0.45359237 kg) before the formula. Resting energy by Mifflin-St Jeor; factors sitting 1.53, active 1.76, very active 2.25; minus 500 when the main goal is lose weight or lose body fat; floor 1,200 (female) or 1,500 (male); calories to the nearest 10, protein 1.6 or 2.0 g/kg to the nearest 5. No weight: `{}`. Weight but not all four of height, age, sex, activity: protein only. Tests, exactly:
   - male, 40, 180 cm, 90 kg, active, lose weight → 2,720 kcal, 180 g, no floor
   - female, 60, 150 cm, 50 kg, sitting, lose weight → 1,200 kcal (floor applied), 100 g
   - male, 30, 175 cm, 80 kg, active, build muscle → 3,080 kcal, 130 g
   - female, 30, 165 cm, 70 kg, very active, lose body fat → 2,700 kcal, 140 g
   - weight only → protein only; nothing → empty

7. Meals, frames 3n to 3p, in the 1b layout.
   - Target card (3n): "Today's target", "Calculated on this phone", eaten against target for kcal and protein. Under it, one line: "An estimate from a standard formula. It can be off by 10% or more for some people; adjust by how your weight actually moves." With the floor applied, frame 3p's line. With protein only: the protein row, and "Add height, age, sex and activity in Goal for a calorie target." linking to `/goal`. With no weight: "Add your weight in Goal to see a target." linking to `/goal`.
   - Parse (3o): matched lines under "On phone" with their numbers; unmatched under "Needs AI" with "Send these lines" and "Enter kcal myself". Send opens the Phase 9 preview; the meals payload now carries only the unmatched lines plus `foods` and the free-text baseline, and each returned line is stored with `source: 'ai'`. "Enter kcal myself" (3p) saves `source: 'manual'`. The send error state from 3p keeps the line.
   - Totals: today excludes lines still waiting, as the frame says; the week's daily average counts saved days only.
   - Baseline foods editor: a "Baseline foods" row in Settings opens a list (add, edit, delete; name, kcal, protein optional). The free-text baseline field stays below it, labeled "Notes sent with lines that need AI".

8. Goal setter (5a): under Current stats add Height (cm, or ft and in when the display unit is lb), Age, Sex (Male, Female; label "Sex, for the calorie formula"), and Activity (Mostly sitting, Active most days, Very active, each with a one-line description from `docs/TARGETS-AND-PROGRESSION.md`). All optional, with the existing lock line. None of them is ever in any payload: add a test that `buildPayload` output at every level contains none of `heightCm`, `age`, `sex`, `activity`.

9. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Screenshots at 390 px of 3n, 3o, 3p (floor, manual entry, send error) and 5a with the new fields, light and dark, under `phase10b-screens/`. State visible differences.
   c. Set up three baseline foods from frame 3o's numbers: breakfast 480 kcal 30 g, lunch 770 kcal 46 g, protein bar 200 kcal 20 g. Enter the four 3n lines and Parse: three on phone with the frame's numbers, one under Needs AI. Enter 850 kcal myself: totals update, and the stored line says `source: 'manual'`. Send an unmatched line through a mock: the preview shows only that line plus foods and notes; it is logged once in the sent log.
   d. Enter the first worked example's stats in Goal: Meals shows 2,720 kcal and 180 g. Change to the second: the floor line shows.
   e. Existing database from `main` with meal days and a free-text baseline: old parsed days display unchanged (their lines read as `ai`); the free-text baseline is kept.
   f. `git diff --stat main -- src` lists only files these tasks required.

10. Push `phase10b` and open a pull request titled `Phase 10B: meals and targets`. Do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
