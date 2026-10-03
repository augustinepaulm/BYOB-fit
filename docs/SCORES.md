# BYOB-fit: scores, nutrient targets and body noise bands (approved Oct 3, 2026; D-079, D-080)

Status: drafted by Claude, approved by Auggie on Oct 3, 2026 (score parts and weights as drafted; fibre rule 14 g per 1,000 kcal after a primary-source check; sodium, added sugars and saturated fat tracked). Every number comes from a source listed with it, or is marked MODELED (a judgement call) or OPEN (not yet sourced, must be resolved before the phase that builds it).

## Part 1. Principles

1. Three separate scores, never one combined number (Auggie, Oct 2, 2026). Each score shows its parts, so it is never a black box.
2. A score must not reward an unsafe behaviour. Eating below the safety floor (D-046) never counts in range. A workout part skipped through Discomfort (D-048) is not counted against completeness.
3. A score is computed on the phone from stored data. It is never computed by the AI.
4. Period: the app week, Sunday to Saturday (D-012). The current week counts only dates up to today. Progress shows each week's score as a trend across the program.
5. A part with no data drops out, and the remaining weights are scaled up to fill its share (worked example in Part 3).
6. Every score is rounded to a whole number from 0 to 100.

## Part 2. Training score

| Part | Weight (MODELED) | Rule |
|---|---|---|
| Adherence | 40% | Finished training dates ÷ planned training dates. A planned date is one whose current workout (after day changes, D-069) is not a rest day. A date is finished when a session of its current workout has ended (D-075 rule 1) **and** holds at least one confirmed set or checked item; an ended empty session does not count |
| Completeness | 30% | Confirmed working sets ÷ prescribed working sets, over the per-set items (main, block, abs; D-013, or `logged: true`) of finished sessions. Per item, confirmed sets count up to the prescribed number, so added sets (D-055) cannot push it past 100%. Items skipped through Discomfort (D-048) are left out of both counts |
| Progression | 30% | Each exercise logged this week that has a comparable reference (D-074 rules 4a and 5): its latest session's top set against the reference's top set. Up = 1; Down = 0; Same = 0.5 when the user's first-ranked goal (D-030) is build muscle or get stronger, otherwise Same = 1 (a held weight is success in a maintenance or fat-loss block). No goal set: Same = 1. Exercises with no comparable reference are listed as New and left out |

Worked example (for the executor's test). Goal: build muscle. 5 planned dates, 4 finished: adherence 0.80. 60 of 68 prescribed working sets confirmed: completeness 0.882. 10 comparable exercises, 3 Up, 6 Same, 1 Down: progression (3 + 6 × 0.5) ÷ 10 = 0.60.
Score = 100 × (0.40 × 0.80 + 0.30 × 0.882 + 0.30 × 0.60) = 100 × (0.320 + 0.265 + 0.180) = 76.5, shown as **76** (0.7647 before rounding).
Same week with goal lose body fat: progression (3 + 6) ÷ 10 = 0.90; score 100 × (0.320 + 0.265 + 0.270) = **85**.

## Part 3. Nutrition score

| Part | Weight (MODELED) | Rule |
|---|---|---|
| Logging | 25% | Days with a parsed meal day ÷ days in the period |
| Energy | 35% | Logged days whose calories fall in the band ÷ logged days. Band: from the larger of (target × 0.9) and the safety floor, to target × 1.1. The ±10% matches the target's own stated accuracy (TARGETS-AND-PROGRESSION.md: the formula can be off by 10% or more) |
| Protein | 25% | Logged days at or above the protein target (D-046) ÷ logged days |
| Fibre | 15% | Logged days at or above the fibre target (Part 4) ÷ logged days |

AI-estimated values (D-079) count toward the parts and are labelled as estimates wherever shown.

Worked example. 7-day period, 6 days logged: logging 0.857. 4 in the energy band: 0.667. 5 at protein: 0.833. 2 at fibre: 0.333.
Score = 100 × (0.25 × 0.857 + 0.35 × 0.667 + 0.25 × 0.833 + 0.15 × 0.333) = 100 × (0.214 + 0.233 + 0.208 + 0.050) = **71** (0.7059 before rounding).

Missing-data example. No calorie target (height, age or sex not entered) and no fibre target: energy and fibre drop out. Remaining weights 0.25 and 0.25 sum to 0.50, so each is scaled to 0.50. Same week: 100 × (0.5 × 0.857 + 0.5 × 0.833) = **85**.

## Part 4. Nutrient targets and limits

| Nutrient | Target or limit | Source |
|---|---|---|
| Calories | D-046 target; resting energy from an entered BMR when one exists (D-078 rule 3) | TARGETS-AND-PROGRESSION.md Part 1 |
| Protein | D-046: 1.6 g/kg maintenance, 2.0 g/kg lose goals | ISSN 2017. Note: the Dietary Guidelines for Americans 2025–2030 (January 2026, primary read Oct 3, 2026 at cdn.realfood.gov/DGA.pdf) give 1.2–1.6 g/kg/day for the general population. The app's 2.0 g/kg for lose goals is above that range; kept, because ISSN addresses exercising people. Recorded, not changed |
| Fibre (target, scored) | 14 g per 1,000 kcal of the day's calorie target, rounded to the nearest gram. Without a calorie target, the Adequate Intake by sex and age when both are entered: men 19–50 y 38 g, 51 y and over 30 g; women 19–50 y 25 g, 51 y and over 21 g. Otherwise no fibre target | National Academies, Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids (2002/2005), total fibre table (nap.edu, read Oct 3, 2026): an Adequate Intake of 14 g per 1,000 kcal, based on intakes observed to protect against coronary heart disease; no upper limit set. The DGA 2025–2030 primary gives no numeric fibre target (checked Oct 3, 2026) |
| Sodium (limit, shown) | Under 2,300 mg per day | DGA 2025–2030: ages 14 and above; highly active people may benefit from more to offset sweat losses (shown with the limit) |
| Added sugars (limit, shown) | No more than 10 g per meal | DGA 2025–2030. The app logs lines per day, not meals: the limit is checked per line group the user labels as a meal (DEFAULT, D-079 rule 4); unlabelled lines show a daily total with no limit |
| Saturated fat (limit, shown) | No more than 10% of the day's logged calories (g × 9 ÷ kcal) | DGA 2025–2030 |
| Carbohydrate, fat | Shown, no target | No target chosen (D-079) |

Limits are shown against the day, not scored (DEFAULT, D-079 rule 5): the approved nutrition weights cover four parts only.

Worked example. Calorie target 2,720 kcal: fibre target 2,720 × 14 ÷ 1,000 = 38.08, shown as **38 g**. A day at 2,400 kcal with 30 g saturated fat: 30 × 9 ÷ 2,400 = 11.3%, over the 10% limit.

## Part 5. Body score

Only goal measures are scored; everything else is shown as a trend.

| First-ranked goal (D-030) | Measures scored |
|---|---|
| Lose body fat (with build muscle ranked second: recomp) | Body fat mass and skeletal muscle mass |
| Lose body fat | Body fat mass and percent body fat |
| Build muscle | Skeletal muscle mass |
| Lose weight | Weight (OPEN: noise band below) |
| Get stronger, improve cardio, general | No Body score; trends only |

Comparison: the latest entry against the entry dated 21 to 35 days earlier (MODELED window around 4 weeks); if there are several, the one closest to 28 days. No such entry: no Body score, and the screen says it needs two entries about four weeks apart.

Per measure: change in the goal's direction beyond the noise band = 1; within the band = 0.5; beyond the band against the goal = 0. The score is the average of the measures, × 100.

Noise bands (lb users: converted, 0.7 kg = 1.5 lb, 0.9 kg = 2.0 lb, rounded to 0.1):

| Measure | Band | Source |
|---|---|---|
| Percent body fat | 1.0 percentage point | Day-to-day precision error of the InBody 770: 1.0% body fat, 0.7 kg fat mass, 0.9 kg fat-free mass; changes within these likely reflect measurement error (Western Kentucky University, IJES abstract; single source, flagged). A separate lab study found very high test-retest reliability for the InBody 770 (Looney et al., Frontiers in Nutrition, Dec 2024) |
| Body fat mass | 0.7 kg | Same |
| Skeletal muscle mass | 0.9 kg | PROXY: the source measured fat-free mass, which is larger than skeletal muscle mass. No skeletal muscle figure found. Labelled as a proxy until sourced |
| Weight | OPEN | No source yet. Must be sourced before the phase that builds the Body score; until then the lose-weight goal gets trends only |

Worked example (recomp). Skeletal muscle mass +1.1 kg (beyond 0.9): 1. Body fat mass −0.5 kg (within 0.7): 0.5. Score = (1 + 0.5) ÷ 2 × 100 = **75**.

Tape measurements (D-071) and visceral fat level are trends only: no noise data was found for them.

## Part 6. What each Progress view must show (for the design brief)

1. The week's score, large, with its trend across program weeks.
2. Each part as a value with its rule in plain words ("4 of 5 workouts done").
3. A "How this is worked out" sheet with the Part 2, 3 or 5 rules in plain language, including that weights are judgement calls.
4. Missing data named, never silently zero ("No calorie target yet: add height, age and sex in Goals").
5. AI estimates marked wherever they feed a number.
