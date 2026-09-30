# EXEC-11.4: Week day detail and builder fixes (v1.0, Sep 29, 2026)

You are the execution pipeline for BYOB-fit. This is a small change fixing five live defects: implement the numbered tasks exactly, touch only what they name, no new dependencies in `package.json`. A throwaway browser script outside `src/` is allowed and is not committed. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-042 and D-059 after task 2 has placed it. D-060 ("Do this today") is NOT part of this change: keep the day detail's existing button.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.4`. `git log --oneline -1` must show `11672a1`; STOP if not. Write `docs/EXEC-11.4.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` aae04a41c62e9c27c6f2d5af964f6045, `docs/DECISIONS.md` aca0b0b46aa910191bfa33762837a418, `docs/EXEC-11.3.md` e72214d98b570ef1cc3f0024556ae2fe; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` d02aeead9dd14cac6fdc0da3dfb6b71a, `docs/DECISIONS.md` b057905c66e6cda0c5f1ebcbbb49e21e. Re-hash both. Commit with `docs/EXEC-11.4.md`: `Contracts: plan v1.16, D-059 and D-060, EXEC-11.4`.

3. Reproduce first, on the unchanged code, in a scripted browser run in WebKit and Chromium, and paste the results. Fresh profile, `public/templates/starter-4day-upper-lower.json` with `startDate` 2026-08-09 and `programWeeks` 12, clock Tue Sep 29, 2026 (week 8), onboarding marked complete.
   a. Week, open Thursday, at 390 × 844: the rects of the dock button and `.tabbar`. Expected from chat (Chromium): button 754 to 810 px, tab bar 775 to 844 px, tab bar in front.
   b. Open `/program/edit`, leave without any edit, reload: `meta.builderDraft` exists. Expected: yes.
   c. In the builder at 12 weeks: the week hint shows; press minus 6 times: value 8, minus still enabled, hint still shown. Expected: as stated.
   If any result differs, STOP and report it.

4. D-059 rule 1, day detail (`PlannedDay` in `src/screens/WeekScreen.tsx`): its dock sits above the tab bar using the same bottom offset as Today's dock (`var(--tabbar-h)`), through a modifier class, so `.ob-dock` elsewhere is unchanged. The screen's bottom padding clears the dock plus the tab bar, so the last item scrolls fully clear of both.

5. D-059 rules 2 and 3, same component: remove the `PlannedTag` badge from the day detail only (the future-week header on Week keeps it). Under each item's name, show `resolved.cue` when present, styled as Today's `tl-row__cue`.

6. D-059 rule 4, `src/builder/FormsBuilder.tsx` and the entry that opens it: do not write a draft until the program differs from the program the builder opened with (compare serialized JSON). A builder resumed from an existing draft keeps writing on every change and step as today. After the first write, step changes are written too. The "Draft" pill and "Discard draft" show only when a draft exists. Save and Discard behave as before.

7. D-059 rule 5, `Stepper` in `src/onboarding/ui.tsx`: minus is `disabled` at `min`; add an optional `max`, with plus `disabled` at `max`. In the builder's length field pass `max={52}` and show the hint `You're in week N, so the minimum is N weeks.` only when `editing && currentWeek > 1 && programWeeks === minWeeks`. Other Stepper callers change only by minus being disabled at their minimum.

8. Tests: the draft rule (no write before a change; a write after the first change; a resumed draft keeps writing), the stepper's disabled states at `min` and `max`, and the hint condition.

9. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Task 3 re-run after the change, WebKit and Chromium, at 375, 390 and 440 px: the dock button's bottom is at or above the tab bar's top, a scripted tap on it navigates, and after scrolling to the end the last item's bottom is at or above the dock's top. Use the longest day of the 4-day starter; paste the rects.
   c. Builder, scripted: open and leave without an edit, reload: no `builderDraft`. Open, change the name, leave, reload: the draft exists and reopening resumes it. Discard: gone.
   d. Stepper at week 8 of 12: minus steps 12 to 8 and is then disabled; the hint appears only at 8; "Ends Saturday, Oct 3" at 8.
   e. Screenshots at 390 px, light and dark, under `phase11.4-screens/`: the Thursday day detail scrolled to the end; a day detail with an item that has a cue (use a warm-up item from any starter that carries one, or say none does); the builder length field at 8 weeks.
   f. `git diff --stat main -- src`, including new files, lists only files these tasks required.

10. Push `small-11.4` and open the pull request **as a draft**: `gh pr create --draft --title "Small change 11.4: Week day detail and builder fixes"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
