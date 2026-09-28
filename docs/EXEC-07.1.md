# EXEC-07.1: Units and Appearance in Settings, banner off onboarding (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. This is a small change: implement the numbered tasks exactly, touch only what they name, no new dependencies, no restyling. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-005, D-012, D-039, D-040 and D-041 after task 2 has placed it.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. Phase 7 must already be merged: `git checkout main && git pull`, then `git log --oneline -5` must include `0b412b4` (Phase 7); STOP if not. `git checkout -b small-7.1`. Write `docs/EXEC-07.1.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` 05b3488884d08f9fc7aefb29fc6809c7, `docs/DECISIONS.md` 0693fd312242b74dd3ee6a94b5209e1d, `docs/EXEC-07.md` ef28bdd992bcfb5f2a56196556ffb55f; STOP if any differ.

2. Place by hash from `~/Downloads` (same method as EXEC-07 task 2): `docs/PLAN.md` f33238185213b4260a22b02ffa0cafb6, `docs/DECISIONS.md` d4e388a2f76f35888a579531e382994c. Re-hash both targets. Commit them with `docs/EXEC-07.1.md`: `Contracts: plan v1.7, D-039 to D-041, EXEC-07.1`.

3. Setting and helpers. Add `appearance?: 'system' | 'light' | 'dark'` to `Settings`, with a reader `appearanceOf` (missing means `system`) beside `unitsOf`. Add a pure `effectiveTheme(appearance, systemPrefersDark): 'light' | 'dark'`. Unit tests for both, covering all six combinations.

4. Applying it. On every change of the setting, and on start: `document.documentElement.dataset.theme` is set to `light` or `dark` for an override and removed for `system`; the value is also written to `localStorage` key `byob-appearance` inside try/catch. A small inline script in `index.html`, before the app bundle, reads that key inside try/catch and sets the attribute, so the first paint has the right colours. For `system`, follow live changes of the phone setting through `matchMedia('(prefers-color-scheme: dark)')`. The `theme-color` meta follows the colours in use: Ground light #f5f2ec or Ground dark #171512.

5. CSS. In `src/index.css`, change only selectors, never values: the dark block becomes `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`, and an identical copy of its declarations is added as `:root[data-theme="dark"] { … }`. A unit test reads `src/index.css` and fails if the two dark declaration sets differ in any property or value.

6. Settings screen. At the top of the existing Settings screen add a group titled "General" with two rows, reusing the `Segmented` control from `src/onboarding/ui.tsx`:
   - Units: kg · lb. Under it, in muted text: "Applies to new programs and goals. Your current program keeps its units." (D-040). Changing it writes `settings.units` only; no program, item or logged set is modified.
   - Appearance: System · Light · Dark (D-039). Changing it applies at once, with no reload.
   Nothing else on the screen changes.

7. Banner (D-041). Show the not-advice banner everywhere except the `/welcome` route; decide with a pure, unit-tested function of the path.

8. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Screenshots of Settings at 390 px, saved under `phase7.1-screens/`: System with the OS in light, System with the OS in dark, Light with the OS in dark, Dark with the OS in light. Each must show the colours of the chosen mode.
   c. Choose Dark, reload: the first frame is already dark (no light flash); report how you checked. Choose System and toggle the OS setting with the app open: colours follow without a reload.
   d. With the sample loaded and one set logged at 60, switch Units from kg to lb: the stored program and the logged set are byte-identical before and after (compare their JSON), and the deck still pre-fills 60.
   e. A fresh profile shows no disclaimer banner on any onboarding step, and shows it on Today after onboarding.
   f. `git diff --stat main -- src` lists only the files these tasks required.

9. Push `small-7.1` and open a pull request titled `Small change 7.1: units and appearance`. Do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
