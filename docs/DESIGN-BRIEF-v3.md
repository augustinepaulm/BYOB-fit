# BYOB-fit: Claude Design brief v3.0 (Oct 3, 2026), the rework

Replaces briefs v2.0 and v2.1 for every screen it covers. Decisions behind it: D-077 to D-082 in `docs/DECISIONS.md`; score rules in `docs/SCORES.md`. Where this brief and the v2 canvas differ, this brief wins.

How to use it:
1. Start a new Claude Design project. Attach `design/BYOB-fit_v2_design.dc.html` only as a record of the current flows, not as a visual reference: the look is being replaced.
2. Paste everything below the line. Work the rounds in order and approve each before the next.
3. Placeholder data only (section 8). Nothing personal. The export is committed to a public repo.
4. Export when done (Claude Code handoff format if offered) as `BYOB-fit_v3_design.html`. Never reuse an earlier filename; a reused name once caused the wrong file to be uploaded.

---

## 1. The product in one paragraph

BYOB-fit (Build Your Own Body) is a free, open-source workout app installed from the browser to the home screen. It runs the day's workout one exercise at a time with per-set logging, tracks meals against a calorie and protein target worked out on the phone, logs body composition from an InBody-style scan, and scores each week in three areas: training, nutrition and body. An optional AI, using the person's own key, reviews the program or a week, always after showing exactly what will be sent. All data stays on the phone. Users range from experienced lifters to people new to training and not comfortable with technology.

## 2. The bar

Award level, not template level. References for the standard, not to copy: Any Distance (Apple Design Award 2023, Visuals and Graphics: design-forward workout tracker, data as shareable graphics) and Gentler Streak (Apple Design Award 2024, Social Impact: encouraging tone, wellbeing alongside fitness). What the current app gets wrong, to fix everywhere:
- Five button styles on one screen. Define one hierarchy: primary, secondary, tertiary, destructive, plus one chip style, and use only those.
- A heavy outline on every set box and tick. Logging should feel light: show state by more than a fill change.
- The tab bar is the heaviest thing on screen. It should be the quietest.
- Default system type with one weight jump. Choose a type system with display numerals for weights, reps, timers and scores.
- Lists of empty rows ("No sets logged yet" thirty times). Empty data is never the main content.
- Parser grammar shown to the user in a monospace box.

## 3. Fixed constraints (do not change)

- Ground: paper, #f5f2ec in light. Every other colour is open, including the accent (currently navy #1f3a5f), the dark-mode ground, and the success, warning and danger colours. Propose a full token set, light and dark, with contrast at WCAG AA or better for text.
- Type: fonts must be bundled with the app (the security policy allows only fonts served by the app itself). Name the typeface and its licence; it must be free to redistribute in an MIT repository. No Google Fonts links.
- Charts: inline SVG. No remote images, no external icon fonts; icons as inline SVG.
- 390 × 844 frames, iPhone safe areas respected, light and dark for every frame.
- 44 px minimum touch targets. Sentence case. No exclamation marks. No em dashes in any copy.
- Motion is allowed and must have a reduce-motion version.
- The active set row stays in the top half of the screen while the keyboard is open.

## 4. Navigation (D-077)

Five tabs: **Train, Meals, Body, Progress, Profile**.
- **Train** has two views at the top: **Today** and **Week**.
  - Today: the day's plan grouped by section (warm-up, main, accessories, core, cool-down), a Start button, then the workout deck one exercise at a time: per-set weight and reps boxes, a tick per set, rest timer, Plan sheet (jump, reorder, add exercise, change today's workout, end), Swap, Felt off, + Add set, Done, End, then the session summary ("Compared with last week": Up / Same / Down counts with lines for each exercise that went up; "Ready to progress"; Keep controls).
  - Week: seven days with state (Done, Partly done, Missed, Upcoming, Rest), Change and Restore on today and future dates, "Changed (was Push)" labels, a future day's detail with "Do this today", earlier and later weeks.
- **Meals**: today's entry and targets (section 6).
- **Body**: add an entry, latest values, history (section 5).
- **Progress**: three views, **Training**, **Nutrition**, **Body**, each built around its weekly score (section 7). Training also holds each exercise's history and editing a logged set.
- **Profile**: goals, program (edit, start new), settings (units, appearance, AI key and model, privacy level, AI usage and budget, export, import, sent log, privacy page).

The tab bar shows on every screen, including inside a workout. Inside the deck it must not crowd the set rows; it hides while the keyboard is open. When the user leaves an open workout, a bar above the tabs shows the workout name and the rest timer if running ("Push · rest 1:42"); tapping it returns to the deck exactly where they were.

## 5. Body (D-078)

Entry form, every field optional, one entry per date: weight; skeletal muscle mass; body fat mass; percent body fat; visceral fat level; BMR (kcal/day); waist, chest, hips, upper arm, thigh. Design the form so a scale-only weigh-in takes one field and a full InBody scan takes under a minute: group "Scale", "Body composition", "Tape". Show the latest value and change since the previous entry for each field. History list by date.

## 6. Meals (D-079)

Today's entry stays line-based (one food per line; saved baseline foods expand from one word), but present it as a friendly list, not a code box; the grammar must never be the interface. Per day show: calories against the target band; protein against target; fibre against target; carbohydrate and fat as values; sodium, added sugars and saturated fat against their limits. Any value the AI supplied carries an "AI estimate" mark. A group of lines can be labelled as a meal (Breakfast, Lunch, Dinner, Snack); the added-sugars limit (10 g per meal) shows only on labelled meals. Keep the floor message (calorie target at the safety floor) and the send preview before any AI call.

## 7. Progress and scores (D-080, D-081; rules in SCORES.md, do not invent others)

Each view (Training, Nutrition, Body) shows:
1. The week's score 0 to 100, large, with a trend across program weeks.
2. Its parts in plain words, each with a value: Training "4 of 5 workouts done", "60 of 68 sets", "3 up, 6 same, 1 down"; Nutrition "6 of 7 days logged", "4 days in your calorie range", "5 days at protein", "2 days at fibre"; Body "Muscle +1.1 kg (beyond normal day-to-day change)", "Fat mass −0.5 kg (within normal day-to-day change)".
3. "How this is worked out": a sheet with the rules in plain language, saying the weights are judgement calls.
4. Missing data named, never shown as zero ("Add height, age and sex in Goals to get a calorie range").
5. "Review this week" (AI): opens the send preview; the reply appears as a note card on that week, newest first.
6. Charts:
   - Training: estimated one-rep max per lift over time; weekly working sets per muscle group; an adherence calendar.
   - Nutrition: daily calories against the target band; protein and fibre against their targets; limits as reference lines.
   - Body: weight as a 7-day average over the raw points; skeletal muscle mass and body fat mass on one chart; each tape measurement over time.
The three scores are never combined into one number.

## 8. Placeholder data (use only this)

- Person: no name. Units kg. Goal: lose body fat, then build muscle. Week 6 of 12 of "Upper/lower, 4 days".
- Today (Thursday): Upper B. Warm-up: Rower 5 min. Main: Bench press 4 × 6 to 8 (last week 70 kg × 8, 8, 7, 7); Chest-supported row 3 × 8 to 10; Overhead press 3 × 6 to 8. Accessories: Lateral raise 3 × 12 to 15; Cable curl 3 × 10 to 12. Core: Plank 3 × 45 s.
- This week (week 6): Sun Rest; Mon Upper A Done; Tue Lower A Done; Wed Rest; Thu Upper B (today); Fri Rest, changed (was Lower B); Sat Lower B, changed (was Rest).
- Progress shows last week (week 5, complete). Training score 76: adherence 4 of 5, completeness 60 of 68, progression 3 up, 6 same, 1 down. Previous weeks 68, 71, 74, 70, 73.
- Nutrition score 71: 6 of 7 logged, 4 in range, 5 at protein, 2 at fibre. Target 2,400 kcal, protein 160 g, fibre 34 g. Today 1,850 kcal, 128 g protein, 21 g fibre, sodium 1,900 mg, saturated fat 24 g, added sugars 9 g at lunch.
- Body score 75: skeletal muscle mass 34.2 kg (+1.1 since 4 weeks ago), body fat mass 18.6 kg (−0.5), percent body fat 22.4%, weight 83.0 kg, visceral fat level 8.
- AI note (placeholder text): "Adherence held at four of five sessions. Bench press and row moved up; overhead press stalled two weeks running. Protein was on target most days; fibre was low on four days."

## 9. Rounds

**Round 1. Directions (light only).** Two or three distinct visual directions, each shown on two hero frames: (a) the workout deck mid-exercise, set 2 of 4 active, rest timer running, tab bar visible; (b) Progress > Training with the score, parts and one chart. For each direction: token set, type pairing with licence, button hierarchy, one paragraph on the idea. Stop for approval.

**Round 2. The chosen direction, core flows.** Train: Today (before start, in progress, done), deck (all tile types: load and reps, per side, timed hold, cardio minutes, check-off; Plan sheet; Swap; End dialog; summary), Week (current, future week, day detail, Change sheet). The in-progress bar on another tab. Stop for approval.

**Round 3. The rest.** Meals (empty, entry, totals with limits, AI estimate marks, floor state), Body (form, latest values, history), Progress Nutrition and Body (with score, parts, charts, "How this is worked out", AI note, missing-data states), Profile and Settings (including AI usage and budget). Onboarding: restyle the existing eight steps without changing their content. Stop for approval.

**Round 4. Dark mode and states.** Dark versions of every frame; empty, loading, error and offline states; keyboard-open states for set entry and meal entry. Then export (section header, step 4).
