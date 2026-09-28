# EXEC-07: Onboarding and goals (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. No new dependencies. Do not restyle existing screens, improve, or extend scope. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, and list each under "Judgment calls". Read `docs/PLAN.md` v1.6 sections 4, 5, 6 (Phase 7) and 12, `docs/DECISIONS.md` D-029, D-030, D-031, D-034, D-037 and D-038, and `docs/STARTER-PROGRAMS.md`, after task 2 has placed them. Layout and copy come from `design/BYOB-fit_v2_design.dc.html`, frames 1a to 1l and 5a, with their `-dark` versions. Copy UI text exactly as it appears in those frames.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase7`. Write `docs/EXEC-07.md` from the text the owner pasted and confirm its md5 against the value the owner gives you; STOP if it differs. Confirm `md5` on `main`, in order; STOP if any differ: `docs/PLAN.md` 73f07d200fac65b2a57a3e405658032b, `docs/DECISIONS.md` a1bb1ee2a865bbc5784b5d378e1932d4, `docs/program.schema.json` 8fc9d9917735ff00c3d69f9e4221d9f8, `docs/EXEC-06.md` 1baffd43cd4fcbf7f75659434f82c35e, `public/sample-program.json` 8416d1974b9746f2172f8b73c493a0f9.

2. Place files by hash, not by name. Run `find ~/Downloads -type f \( -name '*.md' -o -name '*.json' \) -exec md5 -r {} +` and copy the one match for each row to its target. Older files with the same names exist in `~/Downloads` (earlier drafts of the starter programs); copy only exact hash matches. STOP and list what is missing if any row has no match. Re-run `md5` on all seven targets and show the output.

   | Target | md5 |
   |---|---|
   | docs/PLAN.md | 05b3488884d08f9fc7aefb29fc6809c7 |
   | docs/DECISIONS.md | 0693fd312242b74dd3ee6a94b5209e1d |
   | docs/program.schema.json | e3ae437fd83a49e9a21ac2a39d38966b |
   | docs/STARTER-PROGRAMS.md | ed27f8fbde2794c79499d631db38f191 |
   | public/templates/starter-3day-fullbody.json | 9b2abfe2ae59a0aba3e80f94290401b2 |
   | public/templates/starter-4day-upper-lower.json | 9c530c1784051b4c2e19cd66a206184c |
   | public/templates/starter-5day-split.json | 1d6934c21f157f6733a5527bb14d4f55 |

   Commit the seven files plus `docs/EXEC-07.md`: `Contracts: plan v1.6, D-037 and D-038, schema correction, starter programs, EXEC-07`. In a separate commit, add `phase*-screens/` to `.gitignore`.

3. Schema correction (D-038). The placed schema closes `byWeek` overrides. In `src/lib/reprogram.ts`, validate each override's `fields` against the same closed shape: `{ $ref: <schema id>#/$defs/itemFields, unevaluatedProperties: false }`. Keep the importer's existing `retiredFrom` check. Seed check: validate `seed/program.json` with the importer's validator on this machine. Print only PASS, or the failing JSON paths and key names; never print values, never commit the file, never change it. If it fails, STOP. Tests: an unknown key inside a `byWeek` override is rejected on import; an AI update override whose `fields` carry an unknown key is rejected; known fields are accepted in both; the sample and all three starter programs validate.

4. First-run routing (PLAN 7.5). New route `/welcome` in `PlainLayout`. `RequireProgram` decides with a pure, unit-tested function: no program and `settings.onboarding.completedAt` absent → `/welcome`; no program but onboarding completed → `/import` (today's behaviour); a program present → proceed. An install that already has a program never sees onboarding.

5. Onboarding, frames 1a to 1l, in the 1b layout with the Phase 6 tokens, light and dark. Answers live in wizard state; Back keeps them; nothing is written until step 8 except where stated.
   - 1a Welcome: no Back, no Skip.
   - 1b Two questions, both required to continue: follows a program (yes/no) and New or Experienced.
   - 1c Safety notice: the exact text in D-029's approved wording as shown in frame 1c, no Skip, one button. Record the acknowledgement time in wizard state.
   - 1d (follows a program): show "Or import a program file" and Skip. Do not show "Build it with forms" (PLAN Phase 7 limit); leave no gap in the layout. Import uses the existing validator in `src/lib/importProgram.ts` inline, shows its errors on failure, and continues to step 5 on success.
   - 1e (does not follow a program): three cards read from `public/templates/`: name, days a week, "about N min" where N is the longest `durationMin` among the program's training days, and level. "Suggested for you": New → 3-day, Experienced → 4-day. Skip allowed.
   - 1f to 1h Goals (D-030): pick one main goal and up to two more from the six types. Targets: lose weight takes an amount with lb or kg; lose body fat takes a percentage; get stronger takes an amount, a unit and an exercise chosen from the selected or imported program's `load_reps` exercises; build muscle, improve cardio and general fitness take no number. Timeframe 4, 8, 12 or 16 weeks, shown as "N weeks, ending <date>". Ranking by drag, plus Move up and Move down controls for accessibility. Current weight and body fat are optional and show the lock line from frame 1h.
   - 1i Units: pre-selected from the unit used in 1g, otherwise kg.
   - 1j AI intro: Set up and Skip share one style.
   - 1k Key and privacy level: paste field, Test using `testKey`, privacy level with Minimal selected; users who answered New see the Standard tip line from frame 1k, and Minimal stays selected. Skip allowed.
   - 1l Summary, then Go to Today. On that tap, in this order, stopping with an inline error if any write fails: save the program (a template gets `startDate` = the Sunday on or before today in local time, and `unit` = the chosen unit on every `load_reps` item; if its id already exists in `programs`, append `-2`, `-3`, and so on); set it active; save goals with `startDate` = today; save settings `units`, `privacyLevel`, the key if one was entered, and `onboarding` with `completedAt`, `followsProgram`, `experience`, `safetyAckAt`. Skipping step 4 saves no program; the app then routes to `/import` by task 4.

6. Goal setter, frame 5a, route `/goal`, reusing the step 5 components on one scrolling screen with Save. Reached from a new "Goal" row at the top of the existing Profile screen showing the goal summary, or "Set a goal" when none exists. The rest of Profile is unchanged. The summary string follows frame 1h exactly, for example "Lose 10 lb in 12 weeks, then get stronger."

7. Offline. The three files in `public/templates/` are in the service worker precache so onboarding works offline after one online visit. The rule for `sample-program.json` is unchanged.

8. Tests as pure functions: the routing decision; the Sunday on or before a date (Sunday, Monday, Saturday, and a week with a daylight-saving change); unit application to `load_reps` items only; the suggested template; the goal summary string for one, two and three goals; the timeframe end date; goal limits (exactly one main, at most three); id de-duplication.

9. Checks, with evidence in the report:
   a. `npm run verify` passes; paste the md5 block, which must show the task 2 values.
   b. Screenshots at 390 px of every onboarding step and 5a, light and dark, each named with its frame id, saved under `phase7-screens/` (ignored, not committed). State any visible difference from the frame.
   c. Fresh profile runs: (1) New, no program, 3-day, lb, lose 10 lb in 12 weeks then get stronger, skip AI: Today shows the current day of the 3-day program, loads empty, unit lb, week 1 of 8. (2) Experienced, follows a program, import the sample: Today shows the sample. (3) Skip every skippable step: the app lands on `/import`. (4) Export after run 1 contains the goals and `onboarding.completedAt`, and no `apiKey`.
   d. Existing database: on `main`, load the sample and log one set; switch to this branch and reload. The app opens on Today, never `/welcome`, and the set is intact. Open Profile, set a goal, save, reload: the goal persists.

10. Push `phase7` and open a pull request titled `Phase 7: onboarding and goals`. Do not merge. Report PASS or FAIL for each task number with evidence, then Judgment calls, then anything you noticed but did not change.
