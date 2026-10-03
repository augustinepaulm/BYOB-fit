# EXEC-11.9: Finished dates and ending a session (v1.0, Oct 2, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly, touch only what they name, no new dependencies, no layout or style changes. A throwaway browser script outside `src/` is allowed and is not committed. Do not touch any Dependabot pull request or branch; nothing under `.github/` changes. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-061, D-069, D-072, D-074 and D-075 after task 2 has placed it.

Two commits after the contracts commit, each passing `npm run verify` on its own: A (tasks 3 and 4, Week and days) and B (tasks 5 to 8, deck and session).

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.9`. `git log --oneline -1` must show `5bbfcd7`; STOP if not. Write `docs/EXEC-11.9.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` 98e76dfacfb44e7973eb2efa25fbf136, `docs/DECISIONS.md` 41f21d6fb81a2a539135a5a966058e7b, `docs/EXEC-11.8.md` cf1ad9a18d6ae58fd33391e92f7f54b5; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` f5e5cbee0341e05c26184e27deee4d1e, `docs/DECISIONS.md` 13d5248ad3721ef3a92eea5316aae83a. Re-hash both; STOP if either differs (older downloads of the same names exist). Commit with `docs/EXEC-11.9.md`: `Contracts: plan v1.24, D-075 and D-076, EXEC-11.9`.

### Commit A: Week and days

3. D-075 rule 1 (`canChangeDate` in `src/lib/dayChanges.ts`): add a fourth parameter, the id of the day the date currently shows. A date is finished only when a session with that date, that `dayId` and an `endedAt` exists. Callers pass it: Week rows pass the row's day; Do this today passes today's day from `dayForDate(program, changes, today)`; the deck's Change today's workout passes the deck's `day`. `ProgramProvider`'s guard without sessions is unchanged. Restore stays inside the same condition as Change, so it follows the same rule.

4. Tests: update the D-074 rule 6 tests in `src/lib/weekShell.test.ts` (fixtures carry `dayId`; source checks match the new calls) and add: ended session of another day on today leaves Change offered; ended session of the shown day hides it; after Restore to the ended day, it is hidden (D-075 rule 2); tomorrow and past unchanged. Commit A: `11.9 A: a date is finished only by its current workout (D-075 rule 1)`.

### Commit B: deck and session

5. D-075 rule 3 (`src/session/useSession.ts`): add `end()` to the session API. It reads the stored session from the hook's ref, does nothing when there is none or it already has `endedAt`, and otherwise commits `endedAt` now. It never calls `ensure()`. `finish()` keeps an existing `endedAt` instead of overwriting it.

6. D-075 rule 3 (`src/screens/DeckScreen.tsx`): call `end()` on all four ways into the summary: the last exercise finished (`advance`), End with nothing left (`endFlow`), the End dialog's "End session", and "End session" on the resume prompt. The summary, its Keep controls and its Done behave as before.

7. D-072 rule 2 (`src/builder/ExercisePicker.tsx` and the deck's swap): the picker gains an optional prop that starts Same muscles off; only the deck's mid-workout swap sets it. The builder's pickers (`FormsBuilder`, `StarterReview`) are unchanged.

8. Tests: `end()` with no stored session writes nothing; with an open session sets `endedAt`; with an ended one leaves it; `finish()` after `end()` keeps the first `endedAt`; each of the four summary paths calls `end()` (a source check is acceptable); the deck's picker starts Same muscles off and a builder picker still starts it on for an exercise with muscles. Commit B: `11.9 B: end on the summary, swap filter off (D-075 rules 3 and 4)`.

9. Checks after commit B, scripted in WebKit and Chromium at 390 × 844 under the D-066 policy, with `public/sample-program.json` imported, evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values; `npm audit` reports 0; the test count is at least 433 plus the new tests.
   b. Rule 1: start today's workout, log one set, Plan, change today to another day. Week's today row shows Change, Restore and "Changed (was ...)". Do this today on a future day is offered. Restore: today shows the first day as Done, with no Change.
   c. Rule 1 regression (D-074 rule 6): finish today's workout through the summary; today shows no Change; tomorrow still does.
   d. Rule 3: start, log one set, End, confirm "End session", then reload the page without tapping Done: Today shows the day as finished and Log offers Edit on that session. Tap Done on a second run and confirm `endedAt` is the End time, not the Done time.
   e. Rule 3, other paths: finishing the last exercise, and the resume prompt's "End session", each store `endedAt` before Done. Opening a workout and ending it with nothing logged stores no session.
   f. Rule 4: Swap in the deck opens with Same muscles off; the builder's swap picker on an exercise with muscles opens with it on.
   g. Regression: the 11.7 End dialog by touch, the summary Keep controls after End (Keep N sets, Keep this order), the Phase 12 checks c and f, the 11.8 checks b and e.
   h. Screenshots at 390 px, light and dark, under `phase11.9-screens/`: Week after a mid-workout Change; Week after Restore.
   i. `git diff --stat main` lists only files these tasks required, nothing under `.github/`.

10. Push `small-11.9` and open the pull request **as a draft**: `gh pr create --draft --title "Small change 11.9: finished dates and ending a session"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence and per-commit hashes, then Judgment calls, then anything noticed but not changed.
