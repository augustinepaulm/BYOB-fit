# EXEC-09: AI flows, with the Phase 8 fix (v1.0, Sep 28, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks exactly. No new dependencies. Do not restyle existing screens, improve, or extend scope. If a step would delete files beyond those named, touch `main`, commit anything under `seed/`, or needs a choice not covered here, STOP and ask. Routine choices inside scope: decide, proceed, list under "Judgment calls". Read `docs/PLAN.md` v1.9 section 6 (Phase 8 note and Phase 9), and `docs/DECISIONS.md` D-004, D-006, D-023, D-025 to D-027, D-031, D-042 and D-043 to D-045, after task 2 has placed them. Layout and copy come from `design/BYOB-fit_v2_design.dc.html`, frames 4a to 4i, 5e and 5h with their `-dark` versions; copy UI text exactly.

Working directory: `~/Code/BYOB-fit`.

## Tasks

1. Branch and baseline. `git checkout main && git pull && git checkout -b phase9`. Write `docs/EXEC-09.md` from the pasted text and confirm its md5 against the owner's value; STOP if it differs. Confirm on `main`: `docs/PLAN.md` 4247c32669bb1d42c5b99b51938711cc, `docs/DECISIONS.md` 1035cf68d7b7cd3ad1e2792ab3b10096, `docs/EXEC-08.md` 12d5247c42d150f20a1105a335415365; STOP if any differ.

2. Place by hash from `~/Downloads`: `docs/PLAN.md` ad85a6e2f1caaff9dc0d104cf39b1ef1, `docs/DECISIONS.md` 3e9686fba3a6b4c477e0ca2d69bd6f49. Re-hash both. Commit with `docs/EXEC-09.md`: `Contracts: plan v1.9, D-043 to D-045, EXEC-09`.

3. Phase 8 fix, its own commit `Fix: starter swaps group by session focus`. Starter swaps and the 2b day header group training days by `focus`, not `name`: in the 3-day starter, a swap on Full body A changes Monday and Friday and never Wednesday, and the header reads "Monday and Friday". Tests for that, and a round trip of a test copy of the sample given an `alternateExerciseId` (do not change `public/sample-program.json`).

4. Payload builder (D-044), pure and unit-tested, in `src/lib/payload.ts`: `buildPayload(kind, level, includeNotes, data)` for `review`, `update` and `meals`, returning `{ summary, message }`. `summary` holds the lines of frames 4h and 4i (program days and exercises, logged sets and sessions, goal summary, rules line count, and at Standard or Full the extra rows); `message` is the exact user message sent. The model request uses `message` and nothing else. Tests assert, per level, which keys appear in `message`: Minimal has no `notes` on the program, no session `note`, no `currentStats`, no Profile fields; Standard adds `experience`; Full adds current weight, and notes only when `includeNotes` is true; Profile fields and the API key never appear at any level. Update `REPROGRAM_SYSTEM_PROMPT` so it describes these inputs instead of "profile fields".

5. Send preview and sent log.
   - A sheet (frames 4h, 4i) opens before every model call: review, update and the existing meals parse (D-045). It shows `summary`, "Show exactly what's sent" expanding to `message`, the privacy level with Change (opens 5e), the never-sent line, Cancel and Send. At Full it also shows an "Include notes" switch, off by default.
   - On Send, append to `sentLog`: `id`, `at`, `kind`, `privacyLevel`, `payloadSummary` (the summary lines joined), `payload` (the exact `message`). Nothing is logged on Cancel.
   - Sent log screen (5h) from Settings: read-only, grouped by month, newest first; a row expands to its summary and payload.
   - Privacy level screen (5e) from Settings, writing `settings.privacyLevel`.

6. AI review (D-026, D-043 rule 2).
   - Banner (4a on Today, 4b on Week) when a program and a goal both exist and the program id is not in `settings.reviewBannerDismissedFor`. Dismiss adds it. Review with no key opens the onboarding AI steps (1j, 1k) as a standalone flow and returns.
   - A review system prompt: review the program against the goal; return the D-025 shape; change only what the goal or the program's own structure justifies; one short reason per change. Keep it in `src/lib/review.ts`.
   - Result (4c) with per-line Accept and Reject, the counter, and "Apply accepted changes", disabled until one is accepted. States in 4d. Accepted changes edit the base program with D-042 rules 3 and 4 applied to items with history.

7. Update program (D-027, D-043 rule 1).
   - Week's "Build next week" card becomes "Update program", opening the 4e sheet: "Edit it myself" opens the builder in edit mode; "Ask AI" runs the update through the preview.
   - It is available whenever a program exists; with no finished session this week, "Ask AI" is disabled with the frame's wording or, if the frame has none, "Log a session first".
   - Apply: each change to an item on a day not yet started this week becomes a `byWeek` override keyed to the current week; each change to an item on a day already started is keyed to the next week. Removes and swaps follow D-043 rule 3. The result screen (4f) states when changes apply, as in the frame, and offers only Discard and Approve all. States in 4g, including offline.
   - Write this as a pure, unit-tested function with cases: a mid-week update touching a started and an unstarted day; a remove of an item with history (retired, not deleted); a remove without history (deleted); an update on the last day of the program.

8. Error naming (D-043 rule 4). Every patch validation error names the path, the key and the item id.

9. Checks, with evidence in the report:
   a. `npm run verify` passes; the md5 block shows the task 2 values.
   b. Screenshots at 390 px of 4a to 4i, 5e and 5h, light and dark, named by frame, under `phase9-screens/`, and of the fixed 2b header. State visible differences.
   c. With a test API key or a local mock of the Messages endpoint (report which), run: one review with two accepted and one rejected change; one mid-week update approved; one meals parse. Each opened the preview first, and each appears once in the sent log with a payload whose keys match its level. Cancel in the preview sends nothing and logs nothing.
   d. For each level, paste the `message` keys sent (not values) as evidence of D-044.
   e. On an existing database from `main` with the sample and sets logged: the update applies from the right days (show the `byWeek` keys written), and a retired item's history remains in Log.
   f. `git diff --stat main -- src` lists only files these tasks required.

10. Push `phase9` and open a pull request titled `Phase 9: AI flows`. Do not merge. Report PASS or FAIL per task with evidence, then Judgment calls, then anything noticed but not changed.
