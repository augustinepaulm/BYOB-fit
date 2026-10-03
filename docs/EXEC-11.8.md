# EXEC-11.8: Bug fixes from Oct 2 device use (v1.0, Oct 2, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly, touch only what they name, no new dependencies. A throwaway browser script outside `src/` is allowed and is not committed. Do not touch any Dependabot pull request or branch; nothing under `.github/` changes. Auggie's exported data, if you use it, is read from `~/Downloads` and never copied into the repository, committed or pasted into the report beyond the specific values asked for. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-047, D-053, D-055, D-063, D-065, D-066, D-067, D-069 and D-074 after task 2 has placed it.

Two commits after the contracts commit, each passing `npm run verify` on its own: A (tasks 3 to 8, deck and summary) and B (tasks 9 to 12, Week and app shell).

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.8`. `git log --oneline -1` must show `d369117`; STOP if not. Write `docs/EXEC-11.8.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` b85df0aec442721f34232b3c0faeacf5, `docs/DECISIONS.md` eda963659ac8ed220783b29f3bded8c7, `docs/EXEC-12.md` 0a46847ffc01d09f42681e7bffd0ff3c; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` 98e76dfacfb44e7973eb2efa25fbf136, `docs/DECISIONS.md` 41f21d6fb81a2a539135a5a966058e7b. Re-hash both; STOP if either differs (older downloads of the same names exist). Commit with `docs/EXEC-11.8.md`: `Contracts: plan v1.23, D-071 to D-074, EXEC-11.8`.

### Commit A: deck and summary

3. D-074 rule 1 (`src/lib/todayPlan.ts`, `currentAfterMove` and its callers): an item moved to the current position or ahead of it becomes current; the replaced item keeps its saved sets; a move to a later position changes nothing. Tests: move ahead, move to the same index, move later, move of the current item later (unchanged from D-065), done items still locked.

4. D-074 rule 2, reproduce first: WebKit and Chromium with touch at 390 × 664, `public/sample-program.json` on a Monday (12 items): open Plan, scroll the list by touch, move an item with the handle, close, reopen, scroll by touch; repeat three times; then the same using Move up / Move down. Record which cases fail to scroll. Fix what reproduces (release pointer capture and clear drag state on pointerup, pointercancel, lostpointercapture and sheet close; no `touch-action: none` outside the handle). In all cases give `.dk-plan__list` `flex: 1; min-height: 0`. If nothing reproduces, make those changes anyway and say so.

5. D-074 rule 3 (`done()` in `src/screens/DeckScreen.tsx`): when Done saves at least one set that was not saved before, start rest at that moment with the finished exercise's rest; when it saves nothing new, leave the timer untouched. Tests for both.

6. D-074 rule 4, summary: remove both volume lines and `volumeByUnit` (and its tests). Add "Compared with last week" (Up / Same / Down counts, one line per Up item with both values and units, New items listed and not counted) and "Ready to progress" (the progression suggestion's text for each exercise where it fires this session). Use the reference entry of rule 5 for the comparison. Keep date, day, week, time, sets done, skipped, felt off and the Keep controls. Tests: up by weight, up by reps at the same weight, same, down, reps-only, timed, New, ready to progress.

7. D-074 rule 5, reference: `findReferenceEntry` (and anything that uses it) accepts an entry only when it is comparable: for a `load_reps` item, an entry with at least one confirmed set that has a weight; for other types, an entry of the same type. Tests: a reps-only entry of the same exercise is skipped for a load item and the next comparable one is used; none comparable gives no reference.
   If `~/Downloads` holds a BYOB-fit export from Auggie (a `.json` whose envelope `app` is BYOB-fit), trace the High-to-low cable fly reference on it, before and after this change, and report: the date, day and type of the entry that supplied "15 reps / 20 reps", and what the reference is after the change. Also list the names of items in that program with `unit: "kg"` or no `unit` on a `load_reps` item. If there is no such file, say so and continue.

8. Commit A: `11.8 A: deck and summary fixes (D-074 rules 1 to 5)`.

### Commit B: Week and app shell

9. D-074 rule 6 (`canChangeDate` in `src/lib/dayChanges.ts` and its callers): a date with a finished session (an `endedAt` for that date) offers neither Change nor Do this today. Tests: finished today, unfinished today, tomorrow, past.

10. D-074 rule 7: check every Phase 12 action (Change a day, Restore, Do this today, Add exercise and its Keep, swap with a prescription, Keep this order, Keep N sets, Log edit) and opening and leaving the builder: none may write `meta.builderDraft` without a builder edit. Report the result; fix any that does. On the summary, when a draft exists, the message adds "Open draft" (to the builder) and "Discard draft" (with a confirmation naming what is discarded), and lists the keep offers that will appear once it is cleared; after Discard, the keep offers appear without leaving the summary.

11. D-074 rule 8: `overscroll-behavior: none` on `html` and `body`; the tab bar's navy reaches the bottom edge of the screen (no page colour below it at rest or pulled). Do not add `viewport-fit=cover` or `env()` offsets.

12. Commit B tests: rule 6 cases, the draft message actions, and a source check for the overscroll rule. Commit: `11.8 B: Week and app shell fixes (D-074 rules 6 to 8)`.

13. Checks after commit B, scripted in WebKit and Chromium at 390 × 844 under the D-066 policy, with evidence in the report:
    a. `npm run verify` passes; the md5 block shows the task 2 values; `npm audit` reports 0.
    b. Rule 1: move an upcoming exercise above the current one; closing the sheet shows the moved exercise; the old one keeps its saved sets.
    c. Rule 2: the task 4 sequence passes in both engines.
    d. Rule 3: tick set 1 (rest starts), type set 2, wait 10 s, tap Done: rest shows the full rest again on the next exercise; with every set ticked, Done leaves the timer as it was.
    e. Rule 4: a session with one heavier set than last week, one same, one first-time exercise, and one at the top of the range on every set: Up 1, Same 1, New 1 listed, Ready to progress listed; no volume anywhere on the summary.
    f. Rule 5: last week's entry of a load exercise logged without weight does not appear as the reference.
    g. Rule 6: after Finish, today's row in Week shows Done with no Change; tomorrow still offers Change.
    h. Rule 7: a full session with a Plan move, Add set and Add exercise and no builder edit reaches a summary with keep offers; with a draft present, Discard on the summary brings them back.
    i. Rule 8: computed `overscroll-behavior` on `html` and `body`; the tab bar's bottom edge equals the viewport's bottom on Today, Week, Log, Meals and Profile.
    j. Regression: the EXEC-11.2 check, the open-session edit check, the 11.5 checks c and f, the 11.7 End dialog by touch, and the Phase 12 checks c and f.
    k. Screenshots at 390 px, light and dark, under `phase11.8-screens/`: the new summary; Week with a finished today; the draft message.
    l. `git diff --stat main` lists only files these tasks required, nothing under `.github/`.

14. Push `small-11.8` and open the pull request **as a draft**: `gh pr create --draft --title "Small change 11.8: bug fixes from Oct 2"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence and per-commit hashes, then Judgment calls, then anything noticed but not changed.
