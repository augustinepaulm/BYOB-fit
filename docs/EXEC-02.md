# EXEC-02: Data layer, import, Today and Week (v1.0, Sep 13, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. Do not restyle, improve, add dependencies beyond those named, or extend scope. Where a task says "must print", capture the real command output for the report. If a step would delete files, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask.

Working directory: `~/Code/BYOB-fit`. Language: TypeScript. Read `docs/PLAN.md` section 5 and `docs/program.schema.json` before writing any code; they are the contract. Read `design/BYOB-fit_Design.html` before writing any UI; it is the visual contract.

## Tasks

1. Branch and contracts. `git checkout main && git pull`. Confirm `md5 docs/PLAN.md docs/program.schema.json public/sample-program.json` prints `1ce4d3173932786423ae96c74606c2c3`, `ed3a0fe2a95c33efc49ed144eb572d8a`, `8416d1974b9746f2172f8b73c493a0f9` in that order; if any differ, STOP. Confirm `git check-ignore -v seed/program.json` still resolves. Create branch `phase2`. Commit the three files with the message `Gate 2: plan v1.3, program schema, sample program`.

2. Dependencies. Add exactly: `idb`, `ajv`, `ajv-formats`, `react-router-dom` (runtime) and `vitest` (dev). Nothing else. Do not add a CSS framework, a state library, a date library, or a component library.

3. Types. `src/types/program.ts`: TypeScript types mirroring `docs/program.schema.json` exactly (Program, Exercise, Day, Section, SectionKind, Item, ItemType, ItemFields, ByWeek). `src/types/stores.ts`: Session, Entry, SetLog, Profile, MealDay, Settings as in PLAN section 5, plus `WeekPlan { programWeek: number, swaps: [dayId, dayId][] }` for recorded day swaps.

4. Program logic, `src/lib/program.ts`, pure functions with unit tests in `src/lib/program.test.ts` (vitest):
   - `currentWeek(program, today: Date): number` per the frozen rule: floor((today - startDate) / 7 days) + 1, clamped to 1..programWeeks; `startDate` is a Sunday.
   - `resolveItem(item, week): ItemFields & { id }`: applies `byWeek` overrides, where an override applies from its key week onward until a higher key takes over.
   - `isLogged(sectionKind, item): boolean`: main, block, abs log; cardio logs minutes; warmup, cooldown, daily do not; `item.logged` overrides.
   - `dayForDate(program, weekPlan, date): Day`: Sunday-based lookup honouring swaps in the WeekPlan.
   - `weekDates(program, week): Date[]` (seven dates).
   Tests: at least 8, covering week 1, mid-block, clamping at both ends, a byWeek override before/at/after its key, a higher key superseding a lower one, the `logged` override, and a swapped day.

5. Validation and import, `src/lib/importProgram.ts`: validate an unknown JSON value against `docs/program.schema.json` using Ajv 2020 with ajv-formats (import the schema file directly; do not copy or rewrite it). Also check that every `exerciseId` and `alternateExerciseId` (including inside `byWeek`) exists in `exercises`. Return either the typed Program or a list of human-readable errors with JSON paths.

6. Storage, `src/db/`: an `idb` database named `byob-fit`, version 1, stores: `programs` (key `id`), `sessions` (key `id`, indexes `date`, `dayId`), `weekPlans` (key `programWeek`), `profile` (single record, key `"me"`), `meals` (key `date`), `settings` (single record, key `"app"`), `meta` (key-value; holds `activeProgramId`). Repository functions with explicit names (`getActiveProgram`, `saveProgram`, `setActiveProgram`, `getWeekPlan`, `saveWeekPlan`, `listSessionsByDay`, and so on). No `localStorage` or `sessionStorage` anywhere.

7. App shell. `react-router-dom` with routes `/`, `/week`, `/log`, `/meals`, `/profile`, `/settings`, `/import`, and a bottom tab bar (Today, Week, Log, Meals, Profile) exactly as the design file shows; Settings is reached from the gear on Profile. On load: if no active program, redirect to `/import`. Take colors, type scale, spacing, radii and the tab bar from `design/BYOB-fit_Design.html`; extract them into CSS variables in `src/index.css`. Support light and dark via `prefers-color-scheme` as the design does. Do not invent styles the design does not have.

8. Import screen (`/import`). Two actions: "Load sample program" (fetches `sample-program.json` relative to the app base) and "Import program file" (file input, `.json`). Both run task 5's validator; on success save, set active, go to `/`; on failure list the errors on screen. This screen also serves Settings, Import program later; build it once.

9. Today screen (`/`). From the design's Today screen: date, day name and focus, expected duration, "Week N of M", then sections in order with their items and resolved prescriptions for the current week (use `resolveItem`). Prescription text rules: `sets x repMin` or `sets x repMin to repMax`; holds as `sets x holdSec s`; distance as `sets x distanceM m`; cardio as `minutes min`; `per side` appended when `perSide`; cue shown in muted text; `index` items get the design's index marker if it has one, otherwise a small "index" label. Show the swap banner when the WeekPlan says today is swapped. Rest days show the design's rest-day state. The Start button is present and styled but, in this phase, shows a one-line notice "Deck arrives in Phase 3" and does nothing else.

10. Week screen (`/week`). From the design's Week screen: program week and dates, seven day cards (Sunday first) with name, focus, duration and a done/partial/not-started state derived from sessions (all not-started in this phase), and a swap action that lets the user pick two days that are `swappableWith` each other and writes the WeekPlan. The "Build next week" card is rendered in its disabled state with the design's copy; it does nothing in this phase.

11. Placeholders. `/log`, `/meals`, `/profile`, `/settings` render the design's page header and a single muted line "Coming in Phase 3" or "Coming in Phase 4" as appropriate, inside the same shell, so navigation works end to end.

12. Checks. `npm run lint` with zero warnings, `npx vitest run` all passing, `npm run build` exit 0. Then `npm run dev`, open `http://localhost:5173/BYOB-fit/` in a desktop browser at 390 px wide, load the sample, and confirm Today and Week render with real data; capture the dev server URL line for the report.

13. Commit and push. Commit on `phase2` with the message `Phase 2: data layer, import, Today and Week`. `git status` must not show anything under `seed/`. `git push -u origin phase2`. Do not merge. Do not open a pull request.

## Report

One line per task, 1 to 13, ending PASS or FAIL, with evidence for 1 (the three md5 values), 4 (the vitest summary line), 12 (lint, test and build tails) and 13 (push output). Then list every decision you made that a task did not cover, however small: file names, component structure, how you read the design file, anything the design left ambiguous. Finish with the raw output of `git log --oneline -5` and `git status`.
