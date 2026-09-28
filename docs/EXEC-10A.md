# EXEC-10A: Training loop in 1b (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. No new dependencies. Do not change screens outside this phase, improve, or extend scope. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/PLAN.md` v1.10 sections 5 and 6 (Phase 10A), `docs/DECISIONS.md` D-011, D-023, D-033, D-042, D-044, D-047 and D-048, and `docs/TARGETS-AND-PROGRESSION.md` Part 2, after task 2 has placed them. Layout and copy come from `design/BYOB-fit_v2_design.dc.html`, frames 3a to 3m with their `-dark` versions; copy UI text exactly, except where this prompt changes it.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase10a`. Write `docs/EXEC-10A.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` ad85a6e2f1caaff9dc0d104cf39b1ef1, `docs/DECISIONS.md` 3e9686fba3a6b4c477e0ca2d69bd6f49, `docs/EXEC-09.md` f51e5a90dfd6ec7539c2cf5df539bfd5, `docs/program.schema.json` e3ae437fd83a49e9a21ac2a39d38966b; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` c731c02451632928980548aa0bd5364c, `docs/DECISIONS.md` 3a5ac7dda568a6c3dd6d5f5d6b2b0368, `docs/program.schema.json` 05f7ae141dfa800c24e46588845ad5da, `docs/TARGETS-AND-PROGRESSION.md` f272d7840a5db2129040dbccd7e5ebfe. Re-hash all four. Commit with `docs/EXEC-10A.md`: `Contracts: plan v1.10, D-046 to D-048, progression field, EXEC-10A`.

3. Types. `Item` gains optional `progression: { sessions?, percent?, step? }` mirroring the schema; the builder and every round trip preserve it untouched (the builder does not edit it). `Entry` gains optional `feltOff: 'easy' | 'hard' | 'discomfort'`. Round-trip test: a program whose items carry `progression` loads and saves byte-identical.

4. Progression engine (D-047), pure and unit-tested, in `src/lib/progression.ts`: `suggestProgression(item, exercise, history, unit)` returns `{ kind: 'weight', to, sessions, sets, reps }`, `{ kind: 'reps' }` or `null`. `history` is the item's recent entries, newest first. Rules, in order:
   - Only `load_reps` items with `repMax` and a weight on every counted set qualify.
   - Qualifies when the last N sessions of this item (N = `progression.sessions`, default 2) each have every working set at `reps >= repMax`, all at the same weight. Anything else returns `null`.
   - Percent: `progression.percent`, else 5 when the exercise's `muscles` include legs, glutes, back or chest and its `equipment` is barbell, machine or cable; else 2.5 (also when metadata is missing).
   - Step: `progression.step`, else by equipment and unit: barbell, machine, cable 2.5 kg or 5 lb; dumbbell 2 kg or 5 lb; anything else or missing 2.5 kg or 5 lb.
   - Increase = the nearest multiple of step to `load × percent / 100`, at least one step; a tie goes to the smaller multiple.
   - If one step is more than 10% of the load, return `{ kind: 'reps' }`.
   Tests (all must pass): barbell bench 60 kg, 4 × 6 to 8, two sessions of 8, 8, 8, 8 → 62.5; the same at 135 lb → 140; barbell back squat 100 kg → 105; barbell bench 75 kg (3.75 is a tie between one and two steps) → 77.5; dumbbell lateral raise 10 kg, 3 × 12 to 15, two sessions of 15, 15, 15 → reps; second session 8, 8, 7, 8 → null; only one qualifying session → null; the two sessions at different weights → null; an item with `progression { sessions: 3, percent: 2, step: 1 }` needs three sessions; an exercise with no metadata at 60 kg → 62.5.

5. Today, frame 3a, in the 1b layout. The Phase 9 banner and the Update program entry keep working.

6. Deck, frames 3b to 3g, in the 1b layout, every tile type and state in the frames.
   - Progression chip on the pre-filled row when `suggestProgression` returns a result. Weight copy: "Try <to>, you hit <sets> × <reps> in your last <sessions> sessions." Reps copy: "Aim for more reps at this weight." Tapping the weight chip fills the weight field; nothing is applied without the tap.
   - Felt off control per exercise (D-048): Too easy, Too hard, Discomfort (skipped). Stored as `entry.feltOff`; Discomfort also marks the entry skipped.
   - Demo slot on every tile (D-033): the exercise's `demo` file from `public/demos/` if present, else the placeholder frame marked "demo". Collapsed by default; expanded the first time each exercise appears for a user whose onboarding answer was New, tracked in `meta` under `demoSeen`.
   - Dictation hint on the set input until the user has logged 3 sets, counted in `meta` under `dictationHintCount`.
   - Swap on the tile opens the swap picker (frame 2c) and changes the exercise for this session only (`entry.exerciseId`); the program is not changed.
   - An empty last-week value is blank, never a dash. The empty set placeholder shows the unit for load items (for example "8 reps · kg").

7. Payload (D-044, D-048). At Standard and Full, `buildPayload` adds `feltOff: [{ itemId, flag }]` from the sessions it sends; the preview's "Felt off" row shows the count. Tests per level.

8. Log, frames 3h and 3i, in the 1b layout: exercise list with search; detail with two week pickers (defaults: latest week with this exercise and the one before), sets side by side as weight × reps, the best set per week (highest weight, then most reps), and the change between them. The history table and sparkline stay below.

9. Week, frames 3j to 3m, in the 1b layout: current week; a week picker for any future week, labeled "As planned today"; future days read-only with "Edit in builder" (edit mode); the swap sheet for days marked `swappableWith`. The Update program entry from Phase 9 stays.

10. Checks, with evidence in the report:
    a. `npm run verify` passes; the md5 block shows the task 2 values.
    b. Screenshots at 390 px of 3a to 3m, light and dark, named by frame, under `phase10a-screens/`. State visible differences.
    c. With the sample: log bench at 60 × 8 for every set in two sessions a week apart; in the third, the chip reads "Try 62.5, you hit 4 × 8 in your last 2 sessions." Tap it: the weight fills. Mark one exercise Too hard: the entry stores it, and a Standard preview shows "Felt off: 1".
    d. Log shows the two weeks side by side for bench with best sets and the change. Week shows a future week "As planned today", and a future day is read-only.
    e. On an existing database from `main` with sessions: nothing is lost, and every screen opens without console errors.
    f. `git diff --stat main -- src` lists only files these tasks required.

11. Push `phase10a` and open a pull request titled `Phase 10A: training loop`. Do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
