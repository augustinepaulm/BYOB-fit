# EXEC-06: Foundation for v2 (v1.0, Sep 27, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. No new dependencies. Do not restyle beyond task 3, improve, or extend scope: this phase adds no screens and changes no layout. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, and list each one under "Judgment calls" in your report. Read `docs/PLAN.md` v1.5 sections 5, 6 (Phase 6), 8 and 12, and `docs/DECISIONS.md` D-012, D-025, D-028, D-030, D-031, D-033 to D-035 after task 2 has placed them.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase6`. Write `docs/EXEC-06.md` from the text the owner pasted and confirm its md5 against the value the owner gives you; STOP if it differs. Confirm `md5` of these files on `main` matches, in order; STOP if any differ:
   - `docs/PLAN.md` e1494884ab2ff9f3317a68252097d3e3
   - `docs/DECISIONS.md` 671b6dbcf369ebb7763261b18f1b75ab
   - `docs/program.schema.json` 99ca7724a761ea782fa106d12b6f15e5
   - `docs/EXEC-05.md` f3f96142b65b443e256dd7af0374c49f
   - `public/sample-program.json` 8416d1974b9746f2172f8b73c493a0f9

2. Place contract and design files by hash, not by name. The owner has downloaded them to `~/Downloads`; names may carry spaces, dots instead of underscores, or " (1)" suffixes, and older exports with similar names may sit beside them or in subfolders. Run `find ~/Downloads -type f \( -name '*.md' -o -name '*.json' -o -name '*.html' \) -exec md5 -r {} +` and, for each row below, copy the file whose md5 matches to the target path. Copy nothing else; in particular do not copy any file with md5 13c8f456e79815db19b85a29c9ec5fdf (a superseded export). STOP and list what is missing if any row has no match.

   | Target | md5 |
   |---|---|
   | docs/PLAN.md | 73f07d200fac65b2a57a3e405658032b |
   | docs/DECISIONS.md | a1bb1ee2a865bbc5784b5d378e1932d4 |
   | docs/program.schema.json | 8fc9d9917735ff00c3d69f9e4221d9f8 |
   | docs/DESIGN-BRIEF-v2.md | de3ff85f61214a2b812b8a5922d60967 |
   | docs/DESIGN-BRIEF-v2.1.md | 4eed874c85c1184cba28c7ebfccf4fad |
   | design/BYOB-fit_v2_design.dc.html | 9a9efdfa60041f89fd173b2992215554 |

   After copying, re-run `md5` on the six targets and show the output; every value must match. Commit the six files plus `docs/EXEC-06.md`: `Contracts: plan v1.5, D-025 to D-036, schema v2, EXEC-06, design v2`. Note that `design/BYOB-fit_v2_design.dc.html` loads `./support.js`, which is not provided; it will not render in a browser. Read its markup and inline styles as the reference; do not try to obtain or add `support.js`.

3. Colour tokens, 1b (D-034, PLAN section 12). In `src/index.css`, change token values only; do not rename, add, or remove any selector or rule outside the `:root` light block and the `prefers-color-scheme: dark` block, and do not touch spacing, radii, or typography. Map every existing token to a PLAN section 12 role, light and dark:
   - `--bg`, `--tabbar-bg`: Ground · `--surface`: Raised surface · `--card`, `--field-future-bg`: Subtle fill
   - `--text`: Ink · `--muted`, `--tab-inactive`: Muted text · `--placeholder`, `--icon-muted`: Placeholder
   - `--hairline`, `--tabbar-border`, `--accent-soft-border`, `--banner-border`: Hairline · `--border`, `--field-border`, `--dashed`: Field and control border · `--chip-idle`: Idle chip
   - `--accent`, `--banner-text`: Accent · `--accent-fg`, `--ok-fg`: Text on filled accent · `--field-confirmed-bg`, `--banner-bg`, `--diff-added-bg`, `--diff-added-tag`: Accent soft fill
   - `--ok`: Done · `--danger`: End, danger · `--warn`: Warning · `--diff-removed-bg`, `--diff-removed-tag`: Warning fill · `--diff-changed-bg`, `--diff-changed-tag`: Subtle fill
   - `--scrim`: Ground with alpha 00
   - Add one new token `--secondary` (Secondary text) to both blocks; use it nowhere yet.
   - Light "Text on filled accent" is not pinned in PLAN: read it from the primary button in frame 1a of the design canvas and report the value and where you found it.
   - Any token not listed here: map it to the nearest role and list it under Judgment calls.
   Also set `theme_color` and `background_color` in `vite.config.ts` and the `theme-color` meta in `index.html` to the dark Ground, #171512.

4. Program types and import, schema v2 (D-035). Update `src/types/program.ts` to mirror `docs/program.schema.json` v2 exactly: `schemaVersion: 1 | 2`; `Exercise` gains optional `muscles`, `equipment`, `level`, `demo` with the schema's enums; `Item` (not `ItemFields`) gains optional `retiredFrom`. Update the header comment to cite PLAN v1.5 and fix the stale `ByWeek` comment to the cumulative wording of D-023. After a file validates, the importer sets `schemaVersion` to 2 before storing. In `src/lib/reprogram.ts`, reject any proposed `add` item that carries `retiredFrom`. Tests: the committed sample (version 1) imports and is stored as 2; a version 2 file using every new field imports; `demo` set to an `https://` URL is rejected; `retiredFrom` inside a `byWeek` override is rejected; a patch `add` item with `retiredFrom` is rejected.

5. Retired items (D-028). Add `isActiveOn(item, date)` in `src/lib/program.ts`: false when `retiredFrom` is set and the date is on or after it. Every place that lists a day's items for a date (Today, the deck, Week's counts and durations, the session summary) skips inactive items. Logged history in Log is untouched. Tests for the boundary: the day before, the day of, the day after.

6. IndexedDB version 3 (PLAN section 5). `DB_VERSION = 3`. In the upgrade for `oldVersion < 3`: create `goals` (out-of-line key, one record `me`) and `sentLog` (keyPath `id`, index `at`), and rewrite `schemaVersion` to 2 on every record in `programs`. Put the program rewrite in a pure function and unit-test it; no new test dependency. Add `Goals` and `SentLogEntry` types to `src/types/stores.ts` exactly as PLAN section 5 lists them, and repository functions to read and write goals and to append and list sent-log entries. No UI uses them yet.

7. Settings fields (PLAN section 5). Add `units`, `privacyLevel`, `onboarding`, `reviewBannerDismissedFor` to the `Settings` type, stored only. Readers treat a missing `units` as `kg` (today's behaviour) and a missing `privacyLevel` as `minimal`. No screen changes.

8. Export envelope version 2 (PLAN section 5). `BACKUP_SCHEMA_VERSION` becomes 2 for writing; the envelope adds `goals` and `sentLog`. Import accepts versions 1 and 2: version 1 restores with no goals and an empty sent log. Any other or missing version is refused as today. `readAllStores` and `replaceAllStores` cover the two new stores. The API key is still never exported. Replace the em dashes in the user-facing error strings in `src/lib/backup.ts` with a colon or a full stop. Tests: a version 1 file imports; a version 2 file round-trips including goals and sent log; version 3 is refused; the exported file never contains `apiKey`.

9. Verify script. `scripts/verify.mjs` also prints the md5 of every file in `design/`.

10. Checks, with evidence in the report:
    a. `npm run verify` passes; paste the md5 block, which must show the task 2 values unchanged.
    b. `npm run dev` at 390 px wide: screenshots of Today, Deck, Week, Log, Meals, Profile and Settings in light mode and in dark mode (14 images, saved under `phase6-screens/`, not committed). Layout must match `main`; only colours differ. `git diff --stat main -- src` must show no `.tsx` file changed except where task 5 required it; list any that did and why.
    c. Fresh browser profile: Load sample program, then export; the file has `schemaVersion` 2 and contains `goals` and `sentLog`. Re-import that file, then import a version 1 export made on `main`; both succeed.
    d. An existing database from `main` (open the app on `main`, load the sample, log one set, then switch to this branch and reload): the app opens, the logged set is still shown, and the stored program reads `schemaVersion` 2.

11. Push `phase6` and open a pull request titled `Phase 6: foundation for v2`. Do not merge. Report PASS or FAIL for each task number with its evidence, then Judgment calls, then anything you noticed but did not change.
