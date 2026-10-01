# EXEC-11.5: Plan sheet with reorder, Add set, banner hidden while typing (v1.0, Sep 30, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly, touch only what they name, no new dependencies in `package.json` (drag uses pointer events, no library). A throwaway browser script outside `src/` is allowed and is not committed. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-042, D-047, D-053, D-055, D-063, D-064 and D-065 after task 2 has placed it. Nothing from D-062 (swap and replace) is in this change; the sheet has no Replace link yet.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.5`. `git log --oneline -1` must show `40730de`; STOP if not. Write `docs/EXEC-11.5.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` d02aeead9dd14cac6fdc0da3dfb6b71a, `docs/DECISIONS.md` b057905c66e6cda0c5f1ebcbbb49e21e, `docs/EXEC-11.4.md` 5fe152524c5ca286844a6b7411c8722a; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` d63deb9f849887bc0d591a07f2452924, `docs/DECISIONS.md` d7549088cce895d96ef38eebebbcf022. Re-hash both; STOP if either differs (an older download of the same name has a different hash). Commit with `docs/EXEC-11.5.md`: `Contracts: plan v1.18, D-061 to D-065, EXEC-11.5`.

3. Stored shape (D-065 rules 1 and 5), `src/types/stores.ts`: `Session.order?: { itemId: string; sectionId: string }[]` and `Entry.addedSets?: number`. Both optional; no migration; the export envelope version does not change.

4. Pure functions, in `src/lib/` with tests (task 11):
   a. Apply today's order to `buildDeck`'s result: listed items in listed order with the listed section; unlisted items after them at their program position in their program section; listed ids not in the deck ignored. Each deck item keeps the `logged` value from its program section (D-065 rule 2).
   b. Move an item to a new index and section: done items never move; others can go anywhere, including between done items (D-065 rule 4).
   c. The current item after a move (D-065 rule 3).
   d. Set rows for an item including its added sets: `setRowsFor` plus `addedSets` more set numbers, L and R on per-side items.

5. Deck header: a "Plan" control beside End (accessible name "Today's plan"), on every deck item.

6. Plan sheet (D-063), opened by Plan, closed by a close control or tapping outside:
   - Today's sections in today's order, empty ones hidden; each item shows its name, its prescription (`prescriptionText`) and its state: done, current or upcoming.
   - Tapping an item's name moves the deck to it and closes the sheet.
   - Each item that is not done has a drag handle and Move up / Move down buttons (accessible names "Move <name> up" / "Move <name> down"). Moving past a section header puts the item in that section. Done items have neither.
   - An End control runs the existing End flow, including its unfinished-items prompt.
   - Viewing, jumping and moving change no set data.

7. The deck follows today's order everywhere: position, "N of M", the section label in the header, the Next tile, Back, Done and the Resume start point. The first move writes `order` to the session; later moves update it. A reload mid-workout keeps the order.

8. Add set (D-055, D-065 rules 5 and 6): below the set rows of every item that has set rows, an "Add set" control adds the next set number and increments `addedSets` on the entry (creating the entry if needed). An added row follows D-053 like any row with no last-week value: reps must be typed. An added row with nothing saved has a Remove control that decrements `addedSets`; saved rows have none.

9. Session summary (D-063 rule 6, D-055, D-065 rules 2, 7 and 8):
   - For each item with added sets: "Keep N sets in program". On tap, raise the base item's `sets` to the number of sets logged today for it, through `loadDraft`, `finishDraft` and `saveProgram`. `byWeek` overrides stay exactly; if the item has a `sets` override in any week, say so beside the control.
   - If today's order differs from the program's: "Keep this order". On tap, write today's order and section moves into that day of the base program; on any moved item whose new section kind would change `isLogged`, set `logged` to its current value.
   - Each control changes to "Kept" after it succeeds. If `meta.builderDraft` exists, show neither and say "Finish or discard your program draft first to keep these changes."
   - Nothing is written to the program without these taps.

10. Banner hidden while typing (D-064 rule 2, D-065 rule 9): while a set box has focus, set `data-set-focus` on `document.documentElement`, and remove it on blur when focus does not move to another set box and on deck unmount. CSS hides `.app-notices` under that attribute. `AppNotices` itself does not change.

11. Tests: task 4's functions (missing and stale ids; done lock; cross-section move; the current-item rule; per-side added rows); progression with 4 confirmed sets at one weight (all at repMax: a suggestion that says 4 sets; set 4 below repMax: none); "Keep N sets" raises base `sets` and leaves `byWeek` identical; "Keep this order" moves an item between sections and writes `logged` only when the kind would change it; a backup round trip keeps `order` and `addedSets` with the envelope version unchanged.

12. Checks, scripted in WebKit and Chromium at 390 × 844, with evidence in the report. Use `public/templates/starter-4day-upper-lower.json`, Tuesday (Lower A: Warm-up i008, Main i009 to i013, Core i014), a fresh profile and a first session unless stated:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Plan opens the sheet with three sections and all 7 items; tapping i012 moves the deck to it.
   c. On i009, Move i012 into Core ahead of i014 (buttons in one run, drag by handle in another): the sheet and the deck agree; the Next tile shown from i011 is i013; the header on i012 says Core. Reload: the order holds.
   d. Move the current item later: the item that takes its place is current.
   e. Move i008 (warm-up, not logged) into Main: it still shows as a check item, not set rows.
   f. On i010 (3 sets) tap Add set: a set 4 row appears and behaves like any row with no last-week value (D-053: ✓ with nothing typed shows "Enter reps"). Remove it; add it again; log 4 sets: stored `n` 1 to 4 and `addedSets: 1`. Reload keeps the row.
   g. End from the sheet: the summary offers "Keep 4 sets in program" for i010 and "Keep this order". With the clock moved to the next Tuesday and neither tapped: i010 has 3 rows and the program order. Repeat with both tapped: i010 has 4 rows and i012 sits in Core.
   h. With a `builderDraft` present, the summary shows neither control and shows the draft message.
   i. Focus a set box: `.app-notices` is hidden and the focus label shows; blur: the banner returns.
   j. Regression: the EXEC-11.2 check (first session, log set 1, Done: only set 1 stored); open-session editing (save 100 × 8, retype 105 and tick, Done, Back, reps 7 and tick: 105 × 7 stored); the 11.3 Face pull check (sample program, Friday, "15–20" fits at 390 px).
   k. Screenshots at 390 px, light and dark, under `phase11.5-screens/`: the sheet with a done, a current and an upcoming item; an added set row with Remove; the summary with both Keep controls.
   l. `git diff --stat main -- src`, including new files, lists only files these tasks required.

13. Push `small-11.5` and open the pull request **as a draft**: `gh pr create --draft --title "Small change 11.5: plan sheet, Add set, banner hidden while typing"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
