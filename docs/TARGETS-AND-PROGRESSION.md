# BYOB-fit: calorie target (O-9) and progression rule (O-10). Approved Sep 28, 2026 (D-046, D-047)

Status: drafted by Claude, approved by Auggie on Sep 28, 2026. Every number comes from a source listed with it, or is marked MODELED (a choice made inside a sourced range). Both DECIDE items were resolved: height, age and sex are collected on the phone only; progression rounds to the nearest step.

## Part 1. Calorie and protein target (O-9)

Computed on the phone, never sent to the model (D-032, D-044). Shown as an estimate, not advice.

### Inputs

| Input | Where it comes from | Note |
|---|---|---|
| Weight | Goal setter, current stats (exists) | Required |
| Height, age, sex | Three optional fields in the goal setter, stored on the phone, never sent at any level (approved) | Mifflin-St Jeor needs all three. Without them the app shows no calorie target, only the protein target |
| Activity | One question with three answers (below) | New |

### Method

| Step | Rule | Source |
|---|---|---|
| 1. Resting energy | Mifflin-St Jeor: 10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5 (men) or − 161 (women) | Mifflin et al., 1990. A 2005 systematic review (Frankenfield et al., J Am Diet Assoc) found it the most reliable of four common equations, within 10% of measured for more people than any other, but with noteworthy individual errors |
| 2. Daily energy | Resting energy × activity factor: Mostly sitting 1.53 · Active most days (about an hour of moderate exercise) 1.76 · Very active 2.25 | FAO/WHO/UNU 2004, Table 5.1 worked PAL values; category ranges 1.40 to 1.69, 1.70 to 1.99, 2.00 to 2.40 (Table 5.3) |
| 3. Goal adjustment | Lose weight or lose body fat: minus 500 kcal/day. All other goals: no change (MODELED: no sourced surplus for muscle gain was found, so the app does not add one) | 2013 AHA/ACC/TOS obesity guideline: prescribe a 500 or 750 kcal/day deficit. 500 chosen as the smaller option |
| 4. Safe floor | Never below 1,200 kcal/day for women or 1,500 for men; when the floor applies, frame 3p's message shows | Same guideline: prescribe 1,200 to 1,500 kcal/day for women and 1,500 to 1,800 for men. The floor is the lower bound of each range |
| 5. Protein | 1.6 g/kg for maintenance goals, 2.0 g/kg for lose goals (MODELED within the source range) | ISSN position stand 2017: 1.4 to 2.0 g/kg/day is sufficient for most exercising people; 2.3 to 3.1 may be needed to keep lean mass during a deficit |
| 6. Rounding | Calories to the nearest 10, protein to the nearest 5 g | MODELED |

Worked example (for the executor's test): man, 40, 180 cm, 90 kg, active, lose weight. Resting 1,830 · daily 3,221 · target 2,720 kcal · protein 180 g.

### Limits to show in the app, in one line under the target
"An estimate from a standard formula. It can be off by 10% or more for some people; adjust by how your weight actually moves."

### Known gaps (not blocking)
The guideline's ranges were written for adults with overweight or obesity. For lean users the floor is a safety net, not a recommended intake. A target that learns from the logged weight trend is a later feature (backlog).

## Part 2. Progression suggestion (O-10)

Auggie's correction, Sep 28, 2026: one good week is not enough to add weight; there is a threshold. The source agrees.

### Rule

| Part | Rule | Source |
|---|---|---|
| Threshold | Suggest more weight only after **two consecutive sessions** of that item in which every working set reached the top of the rep range (`repMax`) at the same weight | ACSM 2009 progression models position stand: increase load 2 to 10% when the person can do the current load for one to two reps over the desired number on two consecutive sessions |
| Size | 5% for exercises whose muscles include legs, glutes, back or chest and that use a barbell, machine or cable; 2.5% for everything else | ACSM 2009: lower percentages for small-muscle exercises, higher for large-muscle exercises (within 2 to 10%) |
| Rounding | To the equipment's step (barbell and machine 2.5 kg or 5 lb; dumbbell 2 kg or 5 lb; cable 2.5 kg or 5 lb; MODELED from common plate and stack increments), never less than one step. Nearest step; a tie goes to the smaller step (approved) | |
| Ceiling | If one step is more than 10% of the current load (for example a 10 kg dumbbell), suggest "Aim for more reps at this weight" instead of more weight | ACSM 2009 upper bound of 10% |
| No metadata | Exercises without `muscles` or `equipment` (such as the v11 seed) use 2.5% and a 2.5 kg or 5 lb step | MODELED, the conservative end |
| Override | An item may carry its own `progression` object (sessions, percent, step) to encode the user's own rules, for example "+5 lb when 4 × 8 is clean" | Schema addition, D-record at freeze |

The chip never applies itself. Copy change from frame 3b: "Try 62.5, you hit 4 × 8 in your last 2 sessions."

### Worked example (for the executor's test)
Barbell bench press, 4 × 6 to 8 at 60 kg. Session 1: 8, 8, 8, 8. Session 2: 8, 8, 8, 8. 5% of 60 kg is 3 kg. Rounded to the nearest 2.5 kg step: +2.5 kg, suggest 62.5 kg (4.2%). Rounded up: +5 kg, suggest 65 kg (8.3%). If session 2 had been 8, 8, 7, 8, no suggestion.

## Decisions (resolved Sep 28, 2026)

1. Height, age and sex: collected on the phone, optional, never sent.
2. Progression rounding: to the nearest step (62.5 kg in the example); a tie goes to the smaller step.
