# EXEC-11: Settings, privacy and polish (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. No new dependencies. Do not improve or extend scope beyond these tasks. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/PLAN.md` v1.12 sections 5, 6 (Phase 11) and 12, and `docs/DECISIONS.md` D-005, D-029, D-031, D-034, D-039, D-040, D-044, D-046 and D-050, after task 2 has placed them. Layout and copy come from `design/BYOB-fit_v2_design.dc.html`, frames 5b to 5j and 7a to 7e, with every `-dark` frame; copy UI text exactly, except where this prompt changes it.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase11`. Write `docs/EXEC-11.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` 22d6bafc7564a15b0dcfa0e0ab0c01f3, `docs/DECISIONS.md` 91936ce8414631a22d5e7d410d63372d, `docs/EXEC-10B.md` 490b7230e2ca66e6dca75f1a88c9f889; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` 994e29d71698f3dfca9b650460a32a19, `docs/DECISIONS.md` 061f058e03ce0c58b610c19d86438650. Re-hash both. Commit with `docs/EXEC-11.md`: `Contracts: plan v1.12, D-050, EXEC-11`.

3. Profile, frame 5b, in the 1b layout: goal card (opens `/goal`), program card with name, "Week N of M", Edit program and Start a new program, current stats summary, and the free label and value fields kept below. Nothing on Profile is removed.

4. Settings, frames 5c, 5d, 5f and 5g, in the 1b layout, keeping every control that exists today:
   - General: Units (with the D-040 line) and Appearance (D-039), directly under Units; frame 5c has no Appearance row, add it there.
   - AI: key with Test, the spend-limit tip and "How to get a key", model name showing the stored value with default `claude-sonnet-5` (D-005), never the frame's `claude-sonnet-4-5`; Privacy level; Sent log.
   - Meals: Baseline foods and the notes field (Phase 10B).
   - Your data: Export with the frame's warning; Monthly backup reminder toggle; Import; Reset with confirmation (5g).
   - About: Privacy (5i), Safety notice (5j), Version from `package.json`.
   After Restore or Reset, re-apply the stored appearance at once (Phase 7.1 left this to the next reload).

5. Privacy page, frame 5i, route `/settings/privacy-page`, and Safety notice, frame 5j, route `/settings/safety`, showing the D-029 text exactly as in onboarding step 3 (reuse the same component or string; a test asserts they are identical).

6. Sent log status (D-050 rule 1). `sentLog` entries gain `status: 'sent' | 'failed'` and `error?`. `sendAndLog` still writes the entry before sending, then updates it when the call returns: `sent` on a response, `failed` with the error message on a network or HTTP error. Missing status reads as `sent`. The 5h row shows "Failed" and the error for failed entries. Tests: success, HTTP error, network error, an old entry without status.

7. Backup reminder (D-050 rule 2): a pure, tested `shouldShowBackupNote(settings, now)`; Today shows one dismissible note linking to Export when the setting is on and `lastExportAt` is missing or more than 30 days old; dismissing stores the time and hides it until 30 days after that. Default for the toggle: on.

8. Privacy copy (D-050 rule 3) in the goal setter and onboarding step 5 stats: weight "Sent only at the Full privacy level"; height, age, sex and activity "Never sent".

9. States, frames 7a to 7e: implement each empty, loading, error and offline state they show, on the screens they name. Where a screen has no frame for a state, reuse the nearest frame's pattern and list it under Judgment calls.

10. Dark mode and colour tokens. Replace every hard-coded colour left in `src/index.css` and in component styles (`#fff`, `#ffffff`, `rgba(...)` scrims and shadows) with tokens from PLAN section 12, adding tokens only where no role fits (list each). Then compare every screen in light and dark against its frame and its `-dark` frame.

11. Smaller parked items:
    - Swap and exercise pickers: search matches name, muscles and equipment.
    - Starter programs are fetched once per page load and shared by onboarding, the builder and the picker.
    - `package.json` version 2.0.0 (D-050 rule 5).

12. Checks, with evidence in the report:
    a. `npm run verify` passes; the md5 block shows the task 2 values.
    b. Screenshots at 390 px of 5b to 5j and 7a to 7e, light and dark, named by frame, under `phase11-screens/`. State visible differences.
    c. A full walk, light then dark: every route in `src/App.tsx` opens without console errors; list them.
    d. `grep` output showing no hard-coded colours left in `src/` outside the token blocks, or each remaining one with its reason.
    e. Sent log: a mock success and a mock failure produce one `sent` and one `failed` row.
    f. Backup note: shown with no export, hidden after an export, shown again with `lastExportAt` set 31 days back.
    g. Android: if an Android phone is available to you, test on it and say so; otherwise run Chrome's Android device emulation at 360 and 412 px and label the evidence "emulation, not device".
    h. An existing database from `main`: nothing lost; export and re-import round-trip.
    i. `git diff --stat main -- src` lists only files these tasks required.

13. Push `phase11` and open a pull request titled `Phase 11: settings, privacy and polish`. Do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
