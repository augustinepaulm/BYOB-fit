# BYOB-fit: Claude Design brief (v1.0, Sep 12, 2026)

Paste everything below the line into a new Claude Design project. Iterate screen by screen. When every screen is approved, Export → Hand off to Claude Code, and download the bundle.

---

## What this is

BYOB-fit (Build Your Own Body) is a personal workout app that runs as a home-screen web app on iPhone. One user. It shows the day's session as a grouped checklist, runs it as a deck of exercise tiles with per-set logging, keeps a simple meal log, and once a week asks an AI model (the user's own API key) to write next week's program. Everything is stored on the phone.

Design a mobile app UI for this. Target: iPhone, 390 × 844 viewport, portrait only. Light and dark mode. The engineering target is React + Vite; the handoff README should say so.

## Design direction

Reference: the look of FitIndex (the smart-scale app). Clean white surfaces, generous whitespace, big numerals, one accent color, hairline dividers, rounded cards. Calm, not gamified. No gradients, no glow, no confetti, no mascots, no illustrations of people.

Typography: one sans-serif family. Weights and reps are the hero numbers and should be large enough to read at arm's length mid-set. Sentence case everywhere. No exclamation marks in UI copy.

Density: a set row must be tappable with a sweaty thumb. Minimum 44 px touch targets. Inputs are large; the keyboard will cover the bottom half of the screen while typing, so the active set row must sit in the top half.

Navigation: bottom tab bar with five tabs: Today, Week, Log, Meals, Profile. Settings is reached from a gear icon on Profile. The deck (active workout) is full-screen and hides the tab bar.

## Screens

### 1. Today
- Header: date, day name (e.g. "Push"), expected duration, program week ("Week 6 of 12").
- Sections in order, each a titled group: Warm-up, Main, Abs, Cooldown, Daily. Each item shows name and prescription ("4 × 6 to 8", "3 × 45 s", "5 min").
- Main items get slightly more visual weight than warm-up and cooldown items.
- A banner state: "Swapped: this is Thursday's session" (design the state; it is hidden most days).
- Primary button at bottom: Start. If a session is already in progress: Resume.
- Empty state for a rest day.

### 2. Deck (active session)
This is the core screen. Design it carefully, with states.
- Header: section name and item count ("Main · 2 of 7"), a thin progress bar across the whole session, a rest timer (mm:ss) that counts down from the item's rest prescription after each set is confirmed, and a small End button.
- Active tile (large card): exercise name, prescription line (sets × reps, tempo, rest), then one row per set. Each row: set number, last week's result for that set in muted text ("60 × 8"), and one input field. The field is pre-filled with last week's value so the user can confirm without typing. Show one input, not two: the user types or dictates "62.5 for 8" and the app parses it. Show the parsed result next to the field once entered.
- Row states: pending (pre-filled, muted), confirmed (checkmark, solid), flagged (could not parse; input kept, small warning text "Couldn't read this, tap to fix").
- Below the rows: "How to perform" as a collapsed disclosure; expanded state shows a short paragraph of text.
- Done button on the tile advances to the next item. Back arrow returns to the previous item without losing data.
- Below the active tile: the next item as a smaller card (name and prescription only), and a third, dimmer card behind it showing just the name. Design this stack so it reads as a queue.
- Item type variants of the active tile, each its own state:
  - Load and reps (the default, above)
  - Bodyweight reps (rows show reps only)
  - Timed hold (rows show seconds; a start/stop control per row)
  - Per side (rows split L and R)
  - Cardio block (single minutes field, an intensity note, a running timer)
  - Check-off (warm-up, cooldown and daily items: a name, an optional prescription, one large checkbox; no rows)
- End-of-session summary: total sets, total volume in kg, duration, items skipped, and a Finish button. Include a "Swap" note if the day was swapped.

### 3. Week
- Seven day cards, Sunday first, each with day name, focus, duration, and a done/partial/not-started state.
- Program week number and dates.
- An action to swap two days (design a simple picker or a drag affordance; two specific days are commonly swapped).
- A card at the bottom: "Build next week" with a one-line description ("Uses this week's log to propose next week's program"), leading to:
  - Proposal state: a diff view against the current week, grouped by day, additions and changes highlighted, with Approve and Edit buttons. The model never applies changes without approval; make that visible in the layout.
  - Loading state and error state ("Couldn't reach the model. Check your key in Settings").

### 4. Log (exercise history)
- Searchable list of exercises.
- Exercise detail: a table of sessions (date, sets as "60 × 8, 60 × 8, 60 × 7"), best set, and a small sparkline of top-set weight over time. No dashboard, no big charts.

### 5. Meals
- One entry per day. A multi-line text area where the user types short lines in a fixed convention (a baseline label plus deviations, e.g. "DFS", "SWAP lunch: rice dal 120 g", "ADD nut mix 25 g").
- A Parse button. Parsed state shows kcal and protein for the day and a per-line breakdown; the raw text stays editable.
- Day and week totals in two metric cards.

### 6. Profile
- A small set of user-entered fields: goal statement, program week and dates, and any targets the user chooses to enter as label/value pairs. No computed health metrics, no charts, no body diagrams.
- Gear icon to Settings.

### 7. Settings
- API key field (masked, with a Test button and a success/error state), model name field, Export data (JSON), Import program (JSON), Reset app (with confirmation).
- A short plain-language note: "Your key and data stay on this phone. Once a week, your log is sent to the model to build next week."

## Placeholder data (use exactly this; no other exercises or numbers)

Day: Push · Week 6 of 12 · about 75 min

Warm-up (check-off): Incline walk 5 min · Band pull-aparts 2 × 15 · Push-ups 1 × 10
Main (load and reps unless noted):
1. Barbell bench press: 4 × 6 to 8, tempo 3-1-1, rest 3 min; last week 60 × 8, 60 × 8, 60 × 7, 57.5 × 8
2. Incline dumbbell press: 3 × 10, rest 2 min; last week 22.5 × 10 ×3
3. Cable fly: 3 × 12, rest 90 s; last week 15 × 12 ×3
4. Seated dumbbell overhead press: 3 × 8 to 10, rest 2 min; last week 16 × 10 ×3
5. Lateral raise: 4 × 12 to 15, rest 60 s; last week 8 × 15 ×4
6. Overhead cable triceps extension: 3 × 8 to 10; last week 25 × 10 ×3
7. Rope pushdown: 3 × 12 to 15; last week 20 × 15 ×3
Abs: Cable crunch 3 × 12 to 15 (load and reps); Plank 3 × 45 s (timed hold)
Cooldown (check-off): Doorway pec stretch 2 × 45 s per side · Cross-body shoulder stretch 2 × 30 s per side
Daily (check-off): Eccentric heel raises 3 × 10 · Deep squat hold 2 × 30 s · Single-leg stance 3 × 30 s per side

Week view days: Sun Legs 1 (90 min) · Mon Push (75) · Tue Pull + Zone 2 (85) · Wed Legs 2 (85) · Thu Light (70) · Fri Upper 2 (85) · Sat Plyo + VO2 (80)

## Do not design

Onboarding, accounts, social features, exercise animations or illustrations, notifications, a marketplace, or any screen not listed above.

## Deliverable

One project, seven screens, with the states listed. Then Export → Hand off to Claude Code with a README stating: React + Vite, mobile-only PWA, IndexedDB for storage, no backend, placeholder data to be replaced by imported JSON.
