# EXEC-12: Change a day, add and change exercises, edit from Log (v1.0, Oct 1, 2026)

You are the execution pipeline for BYOB-fit. This is a phase that changes stored data. Implement the numbered tasks exactly, touch only what they name, no new dependencies. A throwaway browser script outside `src/` is allowed and is not committed. Do not touch any Dependabot pull request or branch; nothing under `.github/` changes. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-042, D-047, D-053, D-055, D-056, D-061, D-063, D-065, D-066 and D-069 after task 2 has placed it.

The work lands as **three commits** after the contracts commit, in this order, each passing `npm run verify` on its own: commit A (tasks 3 to 7, data), commit B (tasks 8 to 11, days), commit C (tasks 12 to 15, exercises). Report evidence per commit.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase-12`. `git log --oneline -1` must show `691ddb7`; STOP if not. Write `docs/EXEC-12.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` 52735519ee6142d413467913a0ac796b, `docs/DECISIONS.md` 94ab91342298260e73a1ebb499266e80, `docs/EXEC-11.7.md` 2709b77c2b4fdcc4c6c44a6aa14e66f6; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` b85df0aec442721f34232b3c0faeacf5, `docs/DECISIONS.md` eda963659ac8ed220783b29f3bded8c7. Re-hash both; STOP if either differs. Commit with `docs/EXEC-12.md`: `Contracts: plan v1.21, D-069 and D-070, EXEC-12`.

### Commit A: data

3. Types (`src/types/stores.ts`):
   - `DayChange { date: string /* YYYY-MM-DD */; dayId: string; setAt: string /* ISO */ }`.
   - `Entry` gains optional `fields?: ItemFields` (the prescription logged today when it differs from the program item), `added?: { fromItemId: string }` (an exercise added today from the plan) and `changed?: true` (an exercise swapped and logged with its own prescription). An added entry's `itemId` is a new unique id that is not a program item id.
   - `SetLog` gains optional `editedAt?: string`.
   - `WeekPlan` is removed once nothing uses it.

4. Database version 4 (`src/db/database.ts`, `src/db/index.ts`): a `dayChanges` store keyed by `date`. The upgrade converts every `weekPlans` record into day changes against the active program: for each date of that program week whose weekday day is one of a swapped pair, a change to its partner. Then the `weekPlans` store is deleted. Follow the existing upgrade pattern (requests pending inside the upgrade transaction). Add `getDayChanges()`, `putDayChange()` and `deleteDayChange(date)`.
   Chat checked this conversion on `main` (691ddb7): for all three starters, two weeks with swaps and one without, the per-date result matched `dayForDate` on all 21 dates each.

5. `dayForDate(program, changes, date)` in `src/lib/program.ts`: the change for that date if there is one, otherwise the weekday's day. A change naming a day id the program no longer has is ignored. Update its three callers (Today, Week, deck) and `ProgramProvider`, which loads all day changes and exposes `changes`, `setChange(date, dayId)` and `restoreDate(date)` in place of `weekPlan` and `applySwap`. `setChange` refuses a date before today.

6. Export envelope version 3 (`src/lib/backup.ts`): `dayChanges` replaces `weekPlans`. Versions 1 and 2 still import: their week plans are converted with the conversion from task 4, using the program in the same file. Error text for unreadable versions names 1, 2 and 3.

7. Commit A tests: the conversion (all three starters, swaps in two weeks, every date of three weeks equal to the old result); the upgrade from a version 3 database holding a week plan (use `fake-indexeddb` only if it is already installed; otherwise test the conversion function and the upgrade wiring separately and say so); `dayForDate` with and without changes, and with a stale day id; export then import round trip at version 3; a version 2 export with a swap imports as the same days. Then commit: `Phase 12 A: day changes replace week plans (D-069)`.

### Commit B: days

8. Week (`src/screens/WeekScreen.tsx`): remove the "Swap days" sheet and its code. Every date from today on, in any week reached by the arrows, has a "Change" action opening a list of the active program's days (name, focus, rest or duration), current one marked. Choosing one shows a confirmation naming the date and both days ("Change Fri, Oct 3 from Upper 2 to Chest?") and, if the date is today and today has logged sets, the D-069 rule 4 text. Confirm writes the change; Cancel changes nothing. A changed date shows "Changed (was <day>)" and Restore. Past dates have neither.

9. Day detail: a future day's only action becomes "Do this today", which runs the rule 8 confirmation for today with that day's workout and, on confirm, opens the deck. The day detail keeps its dock above the tab bar (D-059 rule 1).

10. Deck (`src/screens/DeckScreen.tsx`, `src/screens/PlanSheet.tsx`):
    - The Plan sheet gains "Change today's workout": the same list and confirmation. On confirm, today's current session ends as it stands (as End does), the change is written, and the deck starts the new day's session. What was logged stays in Log.
    - Empty sections stay visible in the Plan sheet for the day, as drop targets (D-069 rule 11). `keepOrder` never removes a section from the program; check the existing code and fix it if it does.
    - Today and the deck read the day through `dayForDate` with changes; a second session on the same date for another day works as today (sessions stay keyed by date and day).

11. Builder: hide the swap-partner control and the swap arrows in the day list (`src/builder/FormsBuilder.tsx`); leave `swappableWith` in the schema and in stored programs untouched. Commit B tests: change, restore, refusal of a past date, the confirmation text with and without logged sets, Do this today, mid-workout change keeping logged sets, empty sections as drop targets, and no swap UI left (source check). Commit: `Phase 12 B: change a day (D-069 rules 1 to 6, 11)`.

### Commit C: exercises

12. Add exercise (D-069 rule 7): "Add exercise" on every deck item and in the Plan sheet opens a list of every active item of the active program across all days, each shown as `<exercise> · <day> · <prescription>`, with search by name. Choosing one inserts an entry right after the current item for today (a new `itemId`, `added.fromItemId`, `fields` copied from that item) and moves the deck to it. It logs like any item of its type. The session summary offers "Keep <exercise> in program", which adds a copy of the item to today's day right after the item it followed, through `loadDraft`, `finishDraft` and `saveProgram`, and is hidden while a builder draft exists (D-065 rule 8). Today's order (D-065 rule 1) includes added entries.

13. Swap with its own prescription (D-069 rule 8): after an exercise is picked in the existing swap sheet, a step "How do you want to log it today?" shows type, sets, reps or seconds or minutes, and rest, filled from that exercise's first active item elsewhere in the program, otherwise from the item being swapped. Confirm stores `exerciseId`, `fields` and `changed: true` on the entry; the rows follow `fields`. Choosing the item's own alternate (the existing "Use X instead") keeps today's behaviour with no step.

14. History and AI (D-069 rules 9 and 10):
    - The reference lookup and Log treat added and changed entries as history of their exercise.
    - The progression suggestion ignores entries with `changed` for the program item.
    - Exercise history in Log (`/log/:exerciseId`): each logged set of an ended session has Edit; the edit uses the same two boxes and parsing as the deck (D-051, D-053), sets `editedAt` on confirm, and Cancel changes nothing. The edited values become the next reference.
    - The AI payload marks added entries "added today", changed entries "changed today" with their fields, and edited sets "edited". The sent log is never rewritten.

15. Commit C tests: the add list (items from every day, an exercise on two days listed twice), insertion position and order, Keep in program (position, hidden with a draft), the swap step's prefill from elsewhere and fallback, progression ignoring changed entries, Log edit (parse errors, `editedAt`, reference after edit), and payload marks. Commit: `Phase 12 C: add and change exercises, edit from Log (D-069 rules 7 to 10)`.

16. Checks after commit C, scripted in WebKit and Chromium at 390 × 844 under the D-066 policy, with evidence in the report. Use the 4-day starter with start 2026-08-09 and 12 weeks, clock Tue Sep 29, 2026, unless stated:
    a. `npm run verify` passes; the md5 block shows the task 2 values; `npm audit` reports 0.
    b. Upgrade: a version 3 database holding a week plan that swaps this week's Thursday and Friday opens at version 4 with `weekPlans` gone, two day changes, and Week showing the same days as before the upgrade.
    c. Change Friday Oct 2 to Monday's day: Friday shows Monday's workout and "Changed (was ...)"; Monday unchanged; Restore puts Friday back. Change a date in week 9. No Change on Monday Sep 28 (past).
    d. From Friday's detail, Do this today: today shows Friday's workout and the deck opens on it; Friday unchanged.
    e. Mid-workout: log sets on two exercises, Change today's workout to another day: both logged exercises stay in Log under today, and the new day's deck starts at its first item.
    f. Add exercise: pick an item from another day; it appears after the current item with that day's prescription; log it; Keep in program places it in today's day after the item it followed.
    g. Swap the cardio warm-up for an exercise that is a timed hold elsewhere in a test program: the step is prefilled from that item; confirm; the rows follow it; next session of that item shows the program prescription again.
    h. Log edit: change a logged set's reps, confirm; the next session's placeholder shows the edited value; the stored set has `editedAt`.
    i. Export at version 3 and re-import into a fresh profile: changes, added and changed entries and edits survive. Import `public/sample-program.json`, and a version 2 export with a swap, successfully.
    j. Regression: the EXEC-11.2 check, the open-session edit check, the 11.5 checks c and f, the 11.7 End dialog by touch.
    k. Screenshots at 390 px, light and dark, under `phase12-screens/`: Week with a changed date; the Change confirmation with logged sets; the Add exercise list; the swap prescription step; a Log edit.
    l. `git diff --stat main` lists only files these tasks required, nothing under `.github/`.

17. Push `phase-12` and open the pull request **as a draft**: `gh pr create --draft --title "Phase 12: change a day, add and change exercises, edit from Log"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence and per-commit hashes, then Judgment calls, then anything noticed but not changed.
