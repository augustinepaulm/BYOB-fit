// Progress (D-077 rule 1, D-080; frames 2.18, 3.09, 3.10, 3.12, 3.14, 4.02):
// Training, Nutrition and Body, each with its week score, trend, parts in
// words, "How this is worked out", missing data named and inline SVG charts.
// Training also holds the exercise list, history and set editing that were
// the Log tab, unchanged in behaviour.

import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { useWeekReview } from '../ai/useWeekReview.tsx'
import { Sheet } from '../builder/ui.tsx'
import { getGoals, listAllSessions, listBodyEntries, listMealDays } from '../db/index.ts'
import { BODY_FIELDS, formatValue, unitLabel, valueIn, type BodyField } from '../lib/body.ts'
import { NOT_TAGGED, bodySeries, indexExerciseIds, oneRepMaxSeries, sevenDayAverage, setsPerMuscle } from '../lib/charts.ts'
import { toISODate } from '../lib/dates.ts'
import { aiEstimated } from '../lib/mealLocal.ts'
import { SODIUM_LIMIT_MG, energyBand, fibreTarget } from '../lib/nutrients.ts'
import { dayForDate, weekDates } from '../lib/program.ts'
import {
  bodyComparison,
  bodyMeasures,
  bodyScore,
  combine,
  countedDates,
  isFinishedSession,
  mainGoal,
  nutritionCounts,
  nutritionDays,
  nutritionParts,
  trainingCounts,
  trainingParts,
  trendSentence,
  type BodyComparison,
  type NutritionCounts,
  type TrainingCounts,
} from '../lib/scores.ts'
import { computeTargets } from '../lib/targets.ts'
import { bodyWeekData, nutritionWeekData, programFor, trainingWeekData, weekSessions } from '../lib/weekNotes.ts'
import { useProgram } from '../program/useProgram.ts'
import { unitsOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Program } from '../types/program.ts'
import type { BodyEntry, DayChange, Goals, MealDay, Session } from '../types/stores.ts'
import { ChartCard, DayLabels, DotRow, LineChart, Sparkline, WeekBars } from '../ui/charts.tsx'
import { AppHeader, EmptyState, ProgressRing, Segmented } from '../ui/shell.tsx'
import { LogScreen } from './LogScreen.tsx'

export type ProgressView = 'training' | 'nutrition' | 'body'

const VIEWS: { value: ProgressView; label: string }[] = [
  { value: 'training', label: 'Training' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'body', label: 'Body' },
]

const DAY_LETTER = new Intl.DateTimeFormat('en-US', { weekday: 'narrow' })

export function ProgressHeader({ view, context }: { view: ProgressView; context?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <AppHeader context={context}>
      <Segmented label="Progress" value={view} options={VIEWS} onChange={(next) => navigate(`/progress/${next}`)} />
    </AppHeader>
  )
}

interface Data {
  sessions: Session[]
  meals: MealDay[]
  body: BodyEntry[]
  goals: Goals | null
}

function useData(): Data | null {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    let live = true
    void Promise.all([listAllSessions(), listMealDays(), listBodyEntries(), getGoals()]).then(([sessions, meals, body, goals]) => {
      if (live) setData({ sessions, meals, body, goals: goals ?? null })
    })
    return () => {
      live = false
    }
  }, [])
  return data
}

/** The score card: the ring, the week, a sentence and the trend (3.09). */
function ScoreCard({ score, week, view, sentence, trend }: { score: number | null; week: number; view: ProgressView; sentence: string; trend?: (number | null)[] }) {
  return (
    <section className="card-v3 score-card">
      {score !== null ? (
        <ProgressRing value={score / 100} label={`Score ${score} of 100`}>
          <span className="score-card__number">{score}</span>
          <span className="score-card__of">of 100</span>
        </ProgressRing>
      ) : null}
      <div className="score-card__text">
        <span className="score-card__week">
          Week {week} · {view}
        </span>
        <span className="score-card__sentence">{sentence}</span>
        {trend && <Sparkline values={trend} />}
      </div>
    </section>
  )
}

function PartBar({ text, value }: { text: string; value: number | null }) {
  return (
    <div className="part">
      <span className="part__text">{text}</span>
      {value !== null && (
        <div className="bar-v3" aria-hidden="true">
          <span className="bar-v3__fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
        </div>
      )}
    </div>
  )
}

function Missing({ text, onAdd }: { text: string; onAdd?: () => void }) {
  return (
    <div className="missing">
      <span>{text}</span>
      {onAdd && (
        <button type="button" className="missing__add" onClick={onAdd}>
          Add
        </button>
      )}
    </div>
  )
}

function HowItWorks({ title, rows, onClose }: { title: string; rows: { weight?: string; head: string; text: string }[]; onClose: () => void }) {
  return (
    <Sheet title={title} body="" onClose={onClose}>
      <div className="how">
        {rows.map((row) => (
          <div className="how__row" key={row.head}>
            {row.weight && <span className="how__weight">{row.weight}</span>}
            <p className="how__text">
              <b>{row.head}</b> {row.text}
            </p>
          </div>
        ))}
        <p className="how__note">
          The weights are judgement calls, not science. A part with no data drops out and the others fill its share. Worked out on your phone, never by the AI. Training,
          nutrition and body are never combined.
        </p>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Sheet>
  )
}

const TRAINING_HOW = [
  { weight: '40%', head: 'Workouts done.', text: 'Planned workouts you finished, out of those planned. A workout counts once it has at least one logged set.' },
  { weight: '30%', head: 'Sets done.', text: "Working sets you logged, out of those planned. Extra sets don't push it past 100%, and anything skipped through Felt off isn't held against you." },
  {
    weight: '30%',
    head: 'Progress.',
    text: "Each exercise's top set against the last comparable one. Up counts fully, down counts nothing. Same counts half when your main goal is muscle or strength, and fully when it's fat loss or maintenance.",
  },
]

const NUTRITION_HOW = [
  { weight: '25%', head: 'Days logged.', text: 'Days with meals logged, out of the days in the week.' },
  { weight: '35%', head: 'Calorie range.', text: 'Logged days within 10% of your calorie target. A day below the safety floor never counts as in range.' },
  { weight: '25%', head: 'Protein.', text: 'Logged days at or above your protein target.' },
  { weight: '15%', head: 'Fibre.', text: 'Logged days at or above your fibre target: 14 g for every 1,000 kcal of your calorie target. AI estimates count, and are marked.' },
]

const BODY_HOW = [
  { head: 'What is scored.', text: 'Only the measures your main goal is about: fat mass and muscle for losing fat while building muscle; fat mass and body fat for losing fat; muscle for building muscle. Everything else is a trend.' },
  { head: 'Against what.', text: 'Your latest entry against the one about four weeks earlier (21 to 35 days).' },
  {
    head: 'Normal change.',
    text: 'A change in your goal’s direction beyond normal day-to-day change counts fully; within it, half; beyond it the other way, nothing. Normal change: 1 point of body fat, 0.7 kg (1.5 lb) of fat mass, 0.9 kg (2.0 lb) of muscle, the last a stand-in until a muscle figure is found.',
  },
]

/** Frame 4.02: the first week, before any full week has ended. */
function FirstWeek({ view, children }: { view: ProgressView; children?: ReactNode }) {
  return (
    <section className="card-v3 score-card score-card--empty">
      <div className="score-card__text">
        <span className="score-card__week">Week 1 · {view}</span>
        <span className="score-card__sentence">Your first score arrives on Sunday, after your first full week.</span>
        {children}
      </div>
    </section>
  )
}

function trainingWords(c: TrainingCounts) {
  return {
    adherence: c.planned ? `${c.finished} of ${c.planned} workouts done` : 'No workouts planned',
    completeness: c.prescribed ? `${c.confirmed} of ${c.prescribed} sets` : 'No sets planned in finished workouts',
    progression: `${c.up} up, ${c.same} same, ${c.down} down${c.newCount ? `, ${c.newCount} new` : ''}`,
  }
}

function TrainingView({ program, data, today, current, changes }: { program: Program; data: Data; today: Date; current: number; changes: DayChange[] }) {
  const navigate = useNavigate()
  const [how, setHow] = useState(false)
  const review = Math.max(1, current - 1)
  const goal = mainGoal(data.goals)
  const counts = (week: number) => trainingCounts({ program, changes, sessions: data.sessions, week, today })
  const first = current <= 1
  const c = counts(first ? 1 : review)
  const parts = trainingParts(c, goal)
  const score = first ? null : combine(parts)
  const w = trainingWords(c)
  const dates = weekDates(program, review).map(toISODate)
  // D-081: the week's score, its parts and the underlying data, at the user's level.
  const ai = useWeekReview({
    enabled: !first,
    review: {
      view: 'training',
      weekStart: dates[0],
      programWeek: review,
      score,
      parts: [
        { label: 'Workouts done', value: w.adherence, weight: 40 },
        { label: 'Sets done', value: w.completeness, weight: 30 },
        { label: 'Progress', value: w.progression, weight: 30 },
      ],
      data: trainingWeekData(c),
      summary: [
        { label: 'Training', value: `${w.adherence}, ${w.completeness}, ${w.progression}` },
        { label: 'Lifts', value: 'Sets logged this week, with dates' },
      ],
    },
    data: { program: programFor('training', program), sessions: weekSessions(data.sessions, dates), goals: data.goals, bodyEntries: data.body },
  })
  if (ai.picking) return <>{ai.element}</>

  if (first) {
    return (
      <>
        <FirstWeek view="training">
          <span className="part__label">So far this week</span>
          <PartBar text={w.adherence} value={c.planned ? c.finished / c.planned : null} />
          <PartBar text={w.completeness} value={c.prescribed ? c.confirmed / c.prescribed : null} />
        </FirstWeek>
        <p className="note-v3">Progress needs last week to compare with. It starts in week 2.</p>
        <TrainingCharts program={program} data={data} today={today} review={1} current={current} changes={changes} />
        <LogScreen embedded />
      </>
    )
  }

  const trend = Array.from({ length: review }, (_, i) => combine(trainingParts(counts(i + 1), goal)))
  return (
    <>
      {ai.element}
      <ScoreCard score={score} week={review} view="training" sentence={trendSentence(score, review > 1 ? trend[review - 2] : null)} trend={trend} />
      {ai.notes}
      <section className="card-v3 parts">
        <PartBar text={w.adherence} value={parts[0].value} />
        <PartBar text={w.completeness} value={parts[1].value} />
        <span className="part__text">{c.up + c.same + c.down > 0 ? w.progression : c.newCount ? `${c.newCount} new, nothing to compare with yet` : 'Nothing to compare with yet'}</span>
        {goal === null && <Missing text="No goal yet: Same counts fully until you set one" onAdd={() => navigate('/goal')} />}
        <button type="button" className="btn btn--tertiary how-link" onClick={() => setHow(true)}>
          How this is worked out
        </button>
      </section>
      {ai.button}
      <TrainingCharts program={program} data={data} today={today} review={review} current={current} changes={changes} />
      <LogScreen embedded />
      {how && <HowItWorks title="How the training score works" rows={TRAINING_HOW} onClose={() => setHow(false)} />}
    </>
  )
}

function TrainingCharts({ program, data, today, review, current, changes }: { program: Program; data: Data; today: Date; review: number; current: number; changes: DayChange[] }) {
  // Estimated one-rep max per lift: the index lifts, or the three most logged load lifts.
  const index = [...indexExerciseIds(program, current)]
  const logged = new Map<string, number>()
  for (const s of data.sessions) for (const e of s.entries) if (e.sets.some((x) => x.weight !== undefined)) logged.set(e.exerciseId, (logged.get(e.exerciseId) ?? 0) + 1)
  const lifts = (index.length ? index : [...logged.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)).slice(0, 4)
  const series = lifts.map((id) => ({ id, name: program.exercises[id]?.name ?? id, points: oneRepMaxSeries(data.sessions, id) })).filter((s) => s.points.length > 0)
  const unit = program.days.flatMap((d) => d.sections.flatMap((s) => s.items)).find((i) => i.unit)?.unit ?? 'kg'

  const weekIso = weekDates(program, review).map(toISODate)
  const weekSessions = data.sessions.filter((s) => weekIso.includes(s.date) && isFinishedSession(s))
  const muscles = setsPerMuscle(weekSessions, program)
  const most = Math.max(1, ...muscles.map((m) => m.sets))

  const weeks = Array.from({ length: Math.min(current, program.programWeeks) }, (_, i) => i + 1)
  const todayIso = toISODate(today)
  return (
    <>
      <ChartCard title="Estimated one-rep max" aside={series.length ? `${unit}, best set each session` : undefined}>
        {series.length === 0 ? (
          <p className="chart-empty">Log a few sessions with weight and reps to see this.</p>
        ) : (
          series.map((s) => (
            <div className="lift" key={s.id}>
              <div className="lift__head">
                <span>{s.name}</span>
                <b>
                  {formatValue(s.points[s.points.length - 1].value, 'mass')} {unit}
                </b>
              </div>
              <LineChart series={[{ points: s.points, tone: 'sage' }]} height={56} label={`${s.name} estimated one-rep max`} />
            </div>
          ))
        )}
      </ChartCard>
      <ChartCard title="Working sets by muscle group" aside={`Week ${review}`}>
        {muscles.length === 0 ? (
          <p className="chart-empty">No finished workouts this week.</p>
        ) : (
          <div className="hbars">
            {muscles.map((m) => (
              <div className="hbar" key={m.muscle}>
                <span className="hbar__label">{m.muscle === NOT_TAGGED ? 'Not tagged' : m.muscle.replace(/_/g, ' ')}</span>
                <span className="hbar__track">
                  <span className={m.muscle === NOT_TAGGED ? 'hbar__fill hbar__fill--soft' : 'hbar__fill'} style={{ width: `${(m.sets / most) * 100}%` }} />
                </span>
                <span className="hbar__value">{m.sets}</span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
      <ChartCard
        title="Workouts done"
        aside="by week"
        legend={[
          { label: 'Done', tone: 'sage' },
          { label: 'Missed', tone: 'soft' },
          { label: 'Rest', tone: 'line' },
        ]}
      >
        <div className="calendar" role="img" aria-label="Workouts done by week">
          {weeks.map((week) => (
            <div className="calendar__row" key={week}>
              <span className="calendar__week">{week}</span>
              {weekDates(program, week).map((date) => {
                const iso = toISODate(date)
                const day = dayForDate(program, changes, date)
                const done = isFinishedSession(data.sessions.find((s) => s.date === iso && s.dayId === day.id))
                // Today is still to come until it is done.
                const state = day.rest ? 'rest' : done ? 'done' : iso >= todayIso ? 'future' : 'missed'
                return <span key={iso} className={`calendar__cell calendar__cell--${state}`} />
              })}
            </div>
          ))}
          <DayLabels labels={weekDates(program, 1).map((d) => DAY_LETTER.format(d))} />
        </div>
      </ChartCard>
    </>
  )
}

function nutritionSentence(c: NutritionCounts, parts: ReturnType<typeof nutritionParts>): string {
  if (!c.hasEnergyTarget && !c.hasFibreTarget) return c.hasProteinTarget ? 'Scored on logging and protein only for now.' : 'Scored on logging only for now.'
  if (c.logged === 0) return 'Nothing logged this week.'
  const logging = c.logged === c.days ? 'Logged every day.' : c.logged >= c.days - 1 ? 'Logged almost every day.' : `Logged ${c.logged} of ${c.days} days.`
  const names: Record<string, string> = { energy: 'The calorie range', protein: 'Protein', fibre: 'Fibre' }
  const weakest = parts.filter((p) => p.key !== 'logging' && p.value !== null).sort((a, b) => (a.value as number) - (b.value as number))[0]
  return weakest && (weakest.value as number) < 0.5 ? `${logging} ${names[weakest.key]} is the gap.` : logging
}

function NutritionView({ program, data, today, current }: { program: Program | null; data: Data; today: Date; current: number }) {
  const navigate = useNavigate()
  const [how, setHow] = useState(false)
  const targets = computeTargets(data.goals, data.body, toISODate(today))
  const fibre = fibreTarget(targets.kcal, data.goals?.currentStats)
  const review = Math.max(1, current - 1)
  const datesOf = (week: number) => {
    if (program) return countedDates(weekDates(program, week), today).map(toISODate)
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - 7)
    return Array.from({ length: 7 }, (_, i) => toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)))
  }
  const first = Boolean(program) && current <= 1
  const week = first ? 1 : review
  const dates = datesOf(week)
  const days = nutritionDays(dates, data.meals, targets, fibre)
  const c = nutritionCounts(days, targets, fibre)
  const parts = nutritionParts(c)
  const score = first ? null : combine(parts)
  const trend = program && !first ? Array.from({ length: review }, (_, i) => combine(nutritionParts(nutritionCounts(nutritionDays(datesOf(i + 1), data.meals, targets, fibre), targets, fibre)))) : undefined
  const weekItems = data.meals.filter((m) => dates.includes(m.date)).flatMap((m) => m.parsed?.items ?? [])
  const hasAi = aiEstimated(weekItems, 'fibreG') || aiEstimated(weekItems, 'kcal')
  const band = targets.kcal !== undefined ? energyBand(targets.kcal, targets.floor ?? 0) : undefined
  const fullDates = program ? weekDates(program, week) : dates.map((d) => new Date(`${d}T12:00:00`))
  const allDays = nutritionDays(fullDates.map(toISODate), data.meals, targets, fibre)
  const letters = fullDates.map((d) => DAY_LETTER.format(d))
  const kcalMax = Math.max(targets.kcal ? targets.kcal * 1.25 : 0, ...allDays.map((d) => d.kcal ?? 0), 1)
  const sodiumMax = Math.max(SODIUM_LIMIT_MG * 1.25, ...allDays.map((d) => d.sodiumMg ?? 0))

  const partRows = (
    <>
      <PartBar text={`${c.logged} of ${c.days} days logged`} value={parts[0].value} />
      {c.hasEnergyTarget ? (
        <PartBar text={`${c.inBand} ${c.inBand === 1 ? 'day' : 'days'} in your calorie range`} value={parts[1].value} />
      ) : (
        <Missing text="No calorie target yet: add height, age and sex in Goals" onAdd={() => navigate('/goal')} />
      )}
      {c.hasProteinTarget ? (
        <PartBar text={`${c.atProtein} ${c.atProtein === 1 ? 'day' : 'days'} at protein`} value={parts[2].value} />
      ) : (
        <Missing text="No protein target yet: add your weight in Goals" onAdd={() => navigate('/goal')} />
      )}
      {c.hasFibreTarget ? (
        <PartBar text={`${c.atFibre} ${c.atFibre === 1 ? 'day' : 'days'} at fibre`} value={parts[3].value} />
      ) : (
        <Missing text="No fibre target yet: it comes from your calorie target" onAdd={() => navigate('/goal')} />
      )}
    </>
  )
  const missingAny = !c.hasEnergyTarget || !c.hasProteinTarget || !c.hasFibreTarget
  const ai = useWeekReview({
    enabled: !first && Boolean(program),
    review: {
      view: 'nutrition',
      weekStart: fullDates.map(toISODate)[0],
      ...(program ? { programWeek: week } : {}),
      score,
      parts: [
        { label: 'Days logged', value: `${c.logged} of ${c.days} days logged`, weight: 25 },
        { label: 'Calorie range', value: c.hasEnergyTarget ? `${c.inBand} days in range` : 'No calorie target', weight: 35 },
        { label: 'Protein', value: c.hasProteinTarget ? `${c.atProtein} days at protein` : 'No protein target', weight: 25 },
        { label: 'Fibre', value: c.hasFibreTarget ? `${c.atFibre} days at fibre` : 'No fibre target', weight: 15 },
      ],
      data: nutritionWeekData(days, data.meals, targets, fibre),
      summary: [{ label: 'Nutrition', value: 'Daily calories, protein, fibre and the other nutrients against targets; no food lines' }],
    },
    data: { program: null, sessions: [], goals: data.goals, bodyEntries: data.body },
  })
  if (ai.picking) return <>{ai.element}</>

  return (
    <>
      {ai.element}
      {first ? (
        <FirstWeek view="nutrition">
          <span className="part__label">So far this week</span>
          {partRows}
        </FirstWeek>
      ) : (
        <>
          <ScoreCard score={score} week={week} view="nutrition" sentence={nutritionSentence(c, parts)} trend={trend} />
          {ai.notes}
          <section className="card-v3 parts">
            {partRows}
            {hasAi && (
              <p className="parts__note">
                Includes values marked <span className="ai-tag">AI estimate</span>
              </p>
            )}
            {missingAny && <p className="parts__note">{missingNote(c)}</p>}
            <button type="button" className="btn btn--tertiary how-link" onClick={() => setHow(true)}>
              How this is worked out
            </button>
          </section>
          {missingAny && (
            <div className="actions-v3">
              <button type="button" className="btn btn--primary" onClick={() => navigate('/goal')}>
                Go to Goals
              </button>
            </div>
          )}
          {ai.button}
        </>
      )}
      <ChartCard
        title="Calories"
        aside={band ? `band ${Math.round(band.low).toLocaleString('en-US')} to ${Math.round(band.high).toLocaleString('en-US')}` : 'no target yet'}
        legend={[
          { label: 'In range', tone: 'sage' },
          { label: 'Outside', tone: 'soft' },
          { label: 'Not logged', tone: 'line', dashed: true },
        ]}
      >
        <WeekBars
          label="Daily calories against the band"
          max={kcalMax}
          band={band}
          target={targets.kcal}
          days={allDays.map((d) => ({ key: d.date, value: d.kcal, tone: !d.logged ? 'none' : d.inBand || !band ? 'in' : 'out' }))}
        />
        <DayLabels labels={letters} />
      </ChartCard>
      <ChartCard title="Protein and fibre" aside="filled = at target">
        <DotRow label="Protein" days={allDays.map((d) => (!d.logged || targets.proteinG === undefined ? 'none' : d.atProtein ? 'at' : 'below'))} />
        <DotRow label="Fibre" days={allDays.map((d) => (!d.logged || fibre === undefined ? 'none' : d.atFibre ? 'at' : 'below'))} />
        <div className="dot-row">
          <span className="dot-row__label" />
          <DayLabels labels={letters} />
        </div>
      </ChartCard>
      <ChartCard title="Sodium" aside={`limit ${SODIUM_LIMIT_MG.toLocaleString('en-US')} mg`}>
        <WeekBars
          label="Daily sodium against the limit"
          max={sodiumMax}
          limit={SODIUM_LIMIT_MG}
          days={allDays.map((d) => ({ key: d.date, value: d.sodiumMg, tone: d.sodiumMg === undefined ? 'none' : d.sodiumMg >= SODIUM_LIMIT_MG ? 'out' : 'in' }))}
        />
        <DayLabels labels={letters} />
      </ChartCard>
      {how && <HowItWorks title="How the nutrition score works" rows={NUTRITION_HOW} onClose={() => setHow(false)} />}
    </>
  )
}

function missingNote(c: NutritionCounts): string {
  const out = [!c.hasEnergyTarget && 'Calorie range', !c.hasProteinTarget && 'protein', !c.hasFibreTarget && 'fibre'].filter(Boolean) as string[]
  const kept = ['logging', c.hasEnergyTarget && 'calorie range', c.hasProteinTarget && 'protein', c.hasFibreTarget && 'fibre'].filter(Boolean) as string[]
  const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0])
  const head = list(out)
  return `${head[0].toUpperCase()}${head.slice(1)} ${out.length > 1 ? 'drop' : 'drops'} out, and ${list(kept)} ${kept.length > 1 ? 'share their' : 'takes the'} weight until then.`
}

const MEASURE_NAME: Record<string, string> = { skeletalMuscle: 'Muscle', bodyFatMass: 'Fat mass', bodyFatPct: 'Body fat', weight: 'Weight' }

/** Muscle first, as frame 3.10 reads. */
function shownMeasures(comparison: BodyComparison): BodyComparison['measures'] {
  return [...comparison.measures].sort((a, b) => (a.measure === 'skeletalMuscle' ? -1 : b.measure === 'skeletalMuscle' ? 1 : 0))
}

function bodySentence(comparison: BodyComparison): string {
  const words = shownMeasures(comparison).map((m) => {
    const noun = m.measure === 'skeletalMuscle' ? 'muscle' : m.measure === 'bodyFatPct' ? 'body fat' : 'fat'
    if (m.change === 0) return `${noun} level`
    const more = m.change > 0
    return m.beyond ? `${more ? 'more' : 'less'} ${noun}` : `a little ${more ? 'more' : 'less'} ${noun}`
  })
  const text = words.join(', ')
  return `${text[0].toUpperCase()}${text.slice(1)}.`
}

function BodyView({ program, data, current, units }: { program: Program | null; data: Data; current: number; units: 'kg' | 'lb' }) {
  const navigate = useNavigate()
  const [how, setHow] = useState(false)
  const review = Math.max(1, current - 1)
  const asOf = program ? toISODate(weekDates(program, review)[6]) : undefined
  const measures = bodyMeasures(data.goals)
  const comparison = bodyComparison(data.body, measures, units, asOf)
  const score = bodyScore(comparison)
  const goal = mainGoal(data.goals)
  const read = (field: BodyField) => (e: BodyEntry) => valueIn(e, field, units)
  const weights = bodySeries(data.body, read('weight'))
  const average = sevenDayAverage(weights)
  const muscle = bodySeries(data.body, read('skeletalMuscle'))
  const fat = bodySeries(data.body, read('bodyFatMass'))
  const tape = BODY_FIELDS.filter((f) => f.group === 'tape').map((f) => ({ f, points: bodySeries(data.body, read(f.field)) })).filter((t) => t.points.length > 0)
  const ai = useWeekReview({
    enabled: data.body.length > 0 && Boolean(program),
    review: {
      view: 'body',
      weekStart: program ? toISODate(weekDates(program, review)[0]) : '',
      ...(program ? { programWeek: review } : {}),
      score,
      parts: comparison ? shownMeasures(comparison).map((m) => ({ label: MEASURE_NAME[m.measure], value: `${m.change > 0 ? '+' : ''}${m.change} (${m.beyond ? 'beyond' : 'within'} normal day-to-day change)` })) : [],
      data: bodyWeekData(comparison),
      summary: [{ label: 'Body', value: comparison ? 'Muscle and fat mass change behind the score' : 'Trends only' }],
    },
    data: { program: null, sessions: [], goals: data.goals, bodyEntries: data.body },
  })
  if (ai.picking) return <>{ai.element}</>

  if (data.body.length === 0) {
    return (
      <EmptyState
        title="No entries yet"
        body="A scale weigh-in is one field. A full scan takes under a minute. The body score needs two entries about four weeks apart."
        action={{ label: 'Add your first entry', onClick: () => navigate('/body/new') }}
      />
    )
  }

  return (
    <>
      {measures.length === 0 ? (
        <section className="card-v3 score-card score-card--empty">
          <div className="score-card__text">
            <span className="score-card__week">Week {review} · body</span>
            <span className="score-card__sentence">
              {goal === 'lose_weight'
                ? 'Trends only for now: a normal day-to-day range for weight is not sourced yet, so losing weight has no body score.'
                : goal === null
                  ? 'Set a goal to get a body score. These are your trends.'
                  : 'Your main goal has no body score. These are your trends.'}
            </span>
          </div>
        </section>
      ) : comparison ? (
        <>
          <ScoreCard score={score} week={review} view="body" sentence={bodySentence(comparison)} />
          {ai.notes}
          <section className="card-v3 parts">
            {shownMeasures(comparison).map((m) => (
              <span className="part__text" key={m.measure}>
                {MEASURE_NAME[m.measure]} {m.change > 0 ? '+' : m.change < 0 ? '−' : '±'}
                {Math.abs(m.change).toFixed(1)} {m.measure === 'bodyFatPct' ? 'points' : units} ({m.beyond ? 'beyond' : 'within'} normal day-to-day change)
              </span>
            ))}
            <button type="button" className="btn btn--tertiary how-link" onClick={() => setHow(true)}>
              How this is worked out
            </button>
          </section>
        </>
      ) : (
        <section className="card-v3 score-card score-card--empty">
          <div className="score-card__text">
            <span className="score-card__week">Week {review} · body</span>
            <span className="score-card__sentence">The body score needs two entries about four weeks apart.</span>
          </div>
        </section>
      )}
      {weights.length > 0 && (
        <ChartCard
          title="Weight"
          aside={`7-day average ${formatValue(average[average.length - 1].value, 'mass')} ${units}`}
          legend={[
            { label: 'Each weigh-in', tone: 'soft' },
            { label: '7-day average', tone: 'sage' },
          ]}
        >
          <LineChart label="Weight with a 7-day average" series={[{ points: weights, tone: 'soft', dots: true }, { points: average, tone: 'sage' }]} />
        </ChartCard>
      )}
      {(muscle.length > 0 || fat.length > 0) && (
        <ChartCard
          title="Muscle and fat mass"
          aside={units}
          legend={[
            { label: 'Skeletal muscle', tone: 'sage' },
            { label: 'Body fat mass', tone: 'soft' },
          ]}
        >
          <LineChart label="Skeletal muscle and body fat mass" series={[{ points: muscle, tone: 'sage' }, { points: fat, tone: 'soft' }]} />
        </ChartCard>
      )}
      <ChartCard title="Tape measurements" aside={tape.length ? unitLabel('length', units) : undefined}>
        {tape.length === 0 ? (
          <>
            <p className="chart-empty">No tape entries yet. Add waist, chest, hips, upper arm or thigh to see them here.</p>
            <button type="button" className="chip" onClick={() => navigate('/body/new')}>
              Add a measurement
            </button>
          </>
        ) : (
          tape.map(({ f, points }) => (
            <div className="lift" key={f.field}>
              <div className="lift__head">
                <span>{f.label}</span>
                <b>
                  {formatValue(points[points.length - 1].value, 'length')} {unitLabel('length', units)}
                </b>
              </div>
              <LineChart series={[{ points, tone: 'sage' }]} height={48} label={`${f.label} over time`} />
            </div>
          ))
        )}
      </ChartCard>
      {ai.button}
      {ai.element}
      {how && <HowItWorks title="How the body score works" rows={BODY_HOW} onClose={() => setHow(false)} />}
    </>
  )
}

/** Progress > Training, Nutrition or Body. */
export function ProgressScreen({ view }: { view: ProgressView }) {
  const { program, today, week, changes } = useProgram()
  const { settings, loading } = useSettings()
  const data = useData()
  const current = program ? week : 2
  const context = program ? (week <= 1 ? 'Week 1 so far' : `Week ${week - 1} review`) : undefined
  return (
    <div className="screen">
      <ProgressHeader view={view} context={context} />
      {data && !loading && (
        <>
          {view === 'training' &&
            (program ? (
              <TrainingView program={program} data={data} today={today} current={current} changes={changes} />
            ) : (
              <EmptyState title="No program yet" body="Your training score appears once you have a program and a full week behind you." />
            ))}
          {view === 'nutrition' && <NutritionView program={program} data={data} today={today} current={current} />}
          {view === 'body' && <BodyView program={program} data={data} current={current} units={unitsOf(settings)} />}
        </>
      )}
    </div>
  )
}
