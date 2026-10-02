# EXEC-11.6: Security hardening (v1.0, Sep 30, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly, touch only what they name. No new dependencies in `package.json`: the lockfile changes only through `npm audit fix`. A throwaway browser script outside `src/` is allowed and is not committed. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/DECISIONS.md` D-066 after task 2 has placed it.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b small-11.6`. `git log --oneline -1` must show `67ddd3d`; STOP if not. Write `docs/EXEC-11.6.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` d63deb9f849887bc0d591a07f2452924, `docs/DECISIONS.md` d7549088cce895d96ef38eebebbcf022, `docs/EXEC-11.5.md` de10132a7ab51207d61af2b695433918; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` 4417ba7070f0ce00172bdcda9018f9e8, `docs/DECISIONS.md` b57381eff589bed83c19956532b14e04. Re-hash both; STOP if either differs. Commit with `docs/EXEC-11.6.md`: `Contracts: plan v1.19, D-066, EXEC-11.6`.

3. Reproduce first, on the unchanged code, and paste the results:
   a. `npm audit` lists fast-uri (moderate) and brace-expansion (high), 2 findings.
   b. Build, then insert into a copy of `dist/index.html` the D-066 rule 3 policy with the real hash of the inline theme script. Served in WebKit and Chromium, the app does not render, and the console shows a refusal to evaluate a string as JavaScript (`'unsafe-eval'`) from schema compilation. Expected as found in chat; if not, STOP and report.

4. D-066 rule 1: `npm audit fix`. Only `package-lock.json` changes; `npm audit` then reports 0. If it wants to change `package.json` or needs `--force`, STOP.

5. D-066 rule 2, precompiled validators:
   - `scripts/build-validators.mjs` loads `docs/program.schema.json` into Ajv 2020 (`allErrors: true`, `strict: false`, ajv-formats, `code: { source: true, esm: true }`), registers two wrapper schemas (the item: `{ $ref: <schema $id>#/$defs/item }`; closed item fields: `{ $ref: <schema $id>#/$defs/itemFields, unevaluatedProperties: false }`), and writes `src/lib/validators.generated.js` exporting `validateProgram`, `validateItem` and `validateItemFields` via `ajv/dist/standalone`.
   - Ajv's standalone output still contains `require(...)` for runtime helpers even with `esm: true`. Rewrite each one into a namespace import with a `.js` path (`import * as __x from "ajv/dist/runtime/equal.js"`), keeping the property access that followed (for example `.default`, `.fullFormats.date`). A default import does not work here; namespace imports were tested in chat. No `require(` may remain. Prepend a header comment saying the file is generated and by which script.
   - `src/lib/importProgram.ts` and `src/lib/reprogram.ts` use these validators. No `new Ajv`, `ajv.compile` or `addFormats` remains anywhere in `src/`. Error formatting keeps reading `.errors` as today.
   - `scripts/verify.mjs`: regenerate into a temporary file and fail if it differs from the committed one.
   - `ajv` and `ajv-formats` stay where they are in `package.json`: the generated file imports their runtime helpers.

6. D-066 rule 3, Content-Security-Policy: a small Vite plugin in `vite.config.ts`, applied to the production build only, inserts `<meta http-equiv="Content-Security-Policy" content="…">` right after `<meta charset>` in the built `index.html`, with exactly the D-066 rule 3 policy. It computes the `sha256` of the inline theme script from the HTML it is transforming. `npm run dev` gets no policy. Leave `index.html` in the repo unchanged.

7. D-066 rule 4: in `.github/workflows/deploy.yml`, pin each `uses:` to the full commit SHA its current tag points to, with the tag in a trailing comment (`uses: actions/checkout@<sha> # v4`). Resolve each with `git ls-remote` and paste the four SHAs. Chat resolved these on Sep 30, 2026; if yours differ, use yours and say so: checkout v4 `11d5960a326750d5838078e36cf38b85af677262`, setup-node v4 `49933ea5288caeca8642d1e84afbd3f7d6820020`, upload-pages-artifact v3 `56afc609e74202658d3ffba0e8f6dda462b719fa`, deploy-pages v4 `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`. Nothing else in the workflow changes.

8. D-066 rule 5: `.github/dependabot.yml`, version 2, two entries: `npm` at `/` and `github-actions` at `/`, both `interval: weekly`.

9. Tests:
   - For the sample program and each starter, `validateProgram` accepts it, and rejects a copy with a bad item `type` and `startDate` `2026-13-45`.
   - `importProgram` returns the same `errors` strings as on `main` for at least three invalid files, including a missing `startDate`, a wrong type and an extra property. Capture the `main` strings before changing the code and paste both.
   - `reprogram`'s existing tests pass unchanged.
   - A source check fails if `new Ajv`, `.compile(` or `require(` appears in `src/`, other than inside test files.

10. Checks, with evidence in the report:
    a. `npm run verify` passes; the md5 block shows the task 2 values; the validators check passes, and fails if you edit one character in the generated file (show it, then revert).
    b. `npm audit` reports 0; `git diff main -- package.json` is empty.
    c. Built `dist/index.html` carries the policy with the correct hash; `npm run dev` serves `index.html` without one.
    d. Served build, WebKit and Chromium, 390 × 844: Today, Week, Log, Meals, Profile, Settings, the builder and the deck all render with no policy violation; the theme script runs (dark appearance stored in `localStorage` shows dark on first paint); importing `public/sample-program.json` through Import succeeds; one importing a broken file shows the same error text as on `main`; a `fetch` to `https://api.anthropic.com/v1/messages` raises no policy violation (the request itself may fail offline); a `fetch` to `https://example.com` is refused by `connect-src`.
    e. The service worker registers and the update banner still works (build twice with a change, reload).
    f. Regression: the EXEC-11.2 check, the open-session edit check, and the 11.5 checks c (reorder and reload) and f (Add set) pass under the policy.
    g. `git diff --stat main` lists only files these tasks required.

11. Push `small-11.6` and open the pull request **as a draft**: `gh pr create --draft --title "Small change 11.6: security hardening"`. Do not mark it ready and do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
