# EXEC-11.7: Navy tab bar, dependable End, quieter Dependabot (v1.0, Oct 1, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly, touch only what they name, no new dependencies. A throwaway browser script outside `src/` is allowed and is not committed. Do not touch, merge, close or comment on any Dependabot pull request or branch. Nothing under `.github/workflows/` changes. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-066 and D-067 after task 2 has placed it.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.7`. `git log --oneline -1` must show `32b935e`; STOP if not. Write `docs/EXEC-11.7.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` 4417ba7070f0ce00172bdcda9018f9e8, `docs/DECISIONS.md` b57381eff589bed83c19956532b14e04, `docs/EXEC-11.6.md` e45b18e1d938aeb95832d0214faae160; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` 52735519ee6142d413467913a0ac796b, `docs/DECISIONS.md` 94ab91342298260e73a1ebb499266e80. Re-hash both; STOP if either differs. Commit with `docs/EXEC-11.7.md`: `Contracts: plan v1.20, D-067 and D-068, EXEC-11.7`.

3. Reproduce End first, on the unchanged code, in WebKit and Chromium with touch enabled (`hasTouch: true`, taps via `locator.tap()`), at 390 × 844. 4-day starter, Tuesday, first session: log set 1 of the squat so the rest timer runs, then tap End (a) at rest, (b) while a set box has focus, (c) after scrolling to the bottom of the exercise. Record what appears each time. Chat saw the "End this session?" box in Chromium in case (a), with clicks. If any case shows nothing in either engine, note it as a reproduction and continue; do not STOP.

4. D-067 rule 1, tab bar, `src/index.css` only:
   - `--tabbar-bg: #1f3a5f` in every appearance block (light, `prefers-color-scheme: dark`, and `[data-theme="dark"]`); `--tabbar-border: #1f3a5f`.
   - `--tab-inactive: #bcc4cf` in every appearance block; a new `--tab-active: #ffffff`.
   - `.tab--active` uses `--tab-active` and weight 700, with a white marker above its icon (2 px tall, about 24 px wide, rounded).
   - The bottom padding under the tabs is navy too, so the whole bar is one block.
   - Nothing else uses these tokens; check with a search and say so.

5. D-067 rule 2, End, `src/screens/DeckScreen.tsx` and `src/index.css`:
   a. Plan and End each have a tap area of at least 44 × 44 px with at least 8 px between them, at 375 and 390 px wide, with and without the rest timer showing.
   b. `endFlow` first blurs `document.activeElement` when it is a set box, then, if any item is not done, opens the existing `Dialog` component (`src/ui/Dialog.tsx`) with the current title and body ("End this session?", the not-done count, "What you logged is kept.") and the two actions "Keep going" and "End session", in place of the inline block. Cancel and the scrim close it. "End session" goes to the summary as now. Remove the inline block.
   c. With nothing left undone, End goes straight to the summary, as now.
   d. The Plan sheet's "End session" uses the same flow.

6. D-067 rule 3, `.github/dependabot.yml` (not under `workflows/`, so no extra token scope): keep both ecosystems at `/`, weekly. Under each add a group (`applies-to: version-updates`, `patterns: ["*"]`, `update-types: ["minor", "patch"]`) and `ignore: [{ dependency-name: "*", update-types: ["version-update:semver-major"] }]`. Keep the D-066 comment and add one line pointing to D-067.

7. Tests: the header layout rule (tap areas and gap, as a source or render check); End opens the dialog when items are not done and goes to the summary when none are; Keep going leaves the deck unchanged; blurring a focused set box before the dialog.

8. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values; `npm audit` reports 0.
   b. Task 3 re-run after the change, both engines, touch taps: in all three cases the dialog appears, and "End session" reaches the summary; "Keep going" returns to the same item with nothing changed.
   c. Header rects at 375 and 390 px, with and without rest: Plan and End widths, heights and the gap between them.
   d. Tab bar at 390 px, light and dark: computed background `rgb(31, 58, 95)`; active label and icon white with the marker; inactive `rgb(188, 196, 207)`. Today and Week docks still sit fully above the tab bar (11.4 check).
   e. The built app still carries the D-066 policy, and every tab renders under it with no violation.
   f. Regression: the EXEC-11.2 check, the open-session edit check, and the 11.5 checks c and f.
   g. Screenshots at 390 px, light and dark, under `phase11.7-screens/`: Today with the tab bar; the deck header with rest running; the End dialog.
   h. `git diff --stat main` lists only files these tasks required, and nothing under `.github/workflows/`.

9. Push `small-11.7` and open the pull request **as a draft**: `gh pr create --draft --title "Small change 11.7: navy tab bar, dependable End, quieter Dependabot"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
