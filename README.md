# BYOB-fit

## What this is

BYOB-fit is a workout app that lives on your phone's home screen. BYOB stands for Build Your Own Body, and the app is also Build Your Own Model: you bring your own training program as a file and your own Anthropic API key. Each day it shows your session as a checklist. You work through it one exercise at a time, logging every set with last week's numbers shown as targets. It also keeps a simple meal log. Once a week it can ask Claude, under your key, to write next week's program from what you actually logged. You review the proposed changes and approve them before any take effect.

## Requirements

- A modern phone or desktop browser (Safari on iOS, Chrome on Android, or any current desktop browser).
- Your own Anthropic API key, for the weekly reprogramming and meal parsing. Everything else works without one.

## Getting started

1. Open the app at <https://augustinepaulm.github.io/BYOB-fit/>. On a phone, use Share → Add to Home Screen (iOS) or Install app (Android) to put it on your home screen.
2. Tap **Load sample program** to look around, or **Import program file** to load your own.
3. To use the model features, open Profile → Settings and paste your API key. Tap **Test** to check it.

## How program files work

A program is a single JSON file checked against [`docs/program.schema.json`](docs/program.schema.json) before anything is saved. A file that fails the check does not load, and the app lists the reason for each problem. A program has exactly seven days, starting on Sunday, and `startDate` must fall on a Sunday. Here is an abridged example with one day shown; a real file lists all seven in `days`:

```json
{
  "schemaVersion": 1, "id": "my-program", "name": "My program",
  "weekStartsOn": "sunday", "programWeeks": 8, "startDate": "2026-09-13",
  "exercises": {
    "goblet-squat": { "name": "Goblet squat", "howTo": "Hold the weight at your chest; sit down between your heels." }
  },
  "days": [
    { "id": "mon", "order": 1, "name": "Monday", "sections": [
      { "id": "mon-main", "kind": "main", "title": "Main", "items": [
        { "id": "m1", "exerciseId": "goblet-squat", "type": "load_reps", "sets": 3, "repMin": 8, "repMax": 12, "unit": "kg" }
      ] }
    ] }
  ]
}
```

For a complete file, see [`public/sample-program.json`](public/sample-program.json), a generic three-day program. If you run the app from a clone, put your own program at `seed/program.json`. That path is gitignored, so your personal program is never committed.

## Privacy and cost

Your program, logs, meals, profile and API key stay in your browser's storage on your device. Only two things leave it: the weekly reprogramming call and the meal-parsing call. Both go straight from your browser to Anthropic, under your own key and billed to your own account. There is no BYOB-fit server. Use Settings → Export data to keep a backup file.

This app and its AI features are not medical, dietary or professional training advice. Check any change to your training or diet with a qualified professional.

## Running it locally

```sh
npm install
npm run dev      # development server
npm run verify   # lint, tests, production build, contract checksums
```

## License

MIT. See [`LICENSE`](LICENSE).

## Status

This is a personal project shared as open source, not a finished consumer product. For the plan, scope and open items, see [`docs/PLAN.md`](docs/PLAN.md). For the history, see [`CHANGELOG.md`](CHANGELOG.md).
