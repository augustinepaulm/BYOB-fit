# Changelog

All notable changes to BYOB-fit are recorded here, one entry per phase of [`docs/PLAN.md`](docs/PLAN.md). The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each entry is dated by its merge commit into `main`.

## [Unreleased]

### Phase 5: PWA, offline shell, backup, docs

- Web app manifest and placeholder home-screen icons; installable on phone and desktop.
- Service worker that precaches the app shell, so the app opens offline after one online visit. The sample program is always fetched from the network first, and model API calls are never intercepted.
- "Update available: Reload" banner; a new version never reloads the page by itself.
- Persistent storage requested on the first program import, with the result shown in Settings.
- Export files named `byob-fit-export-<date>.json`, with `schemaVersion` and `exportedAt`. Import refuses an unknown or missing version before touching any data.
- Not-advice notice on each app load, README for the open-source audience, and this changelog.

## Phase 4: Model, meals, profile, settings - 2026-09-13

- Settings: API key entry with a test call, model name, reprogramming rules, meal baseline.
- Weekly reprogramming: the prompt carries the program, last week's sessions, the profile and the rules. The proposal is shown as a diff and must be approved before it takes effect.
- Meals: day entry in the DFS-plus-delta convention, a parse call, kcal and protein totals.
- Profile screen; export, import and reset of all data; `npm run verify`.

## Phase 3: Deck and logging - 2026-09-13

- Deck: sections in order, one exercise tile at a time, progress, rest timer.
- Per-set logging with last week's numbers as defaults, typed or dictated through the set parser.
- Check-off tiles for warm-up, cool-down and daily items, and a cardio tile with minutes.
- Session summary and the Exercise Log screen. Cumulative `byWeek` overrides, hash routing.

## Phase 2: Data and import - 2026-09-13

- IndexedDB storage and a repository layer for every store.
- Import screen that validates a program file against `docs/program.schema.json`.
- Today and Week screens reading real data.
- Program schema and a generic sample program committed for forks.

## Phase 1: Design - 2026-09-13

- Design brief and the exported screen designs, committed under `design/`.
- Governing plan and decision log committed under `docs/`.

## Phase 0: Setup - 2026-09-13

- Vite, React and TypeScript scaffold.
- GitHub Pages deploy workflow.
- Ignore rules that keep `seed/program.json` out of the repository.
