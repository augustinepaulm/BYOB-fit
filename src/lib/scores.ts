// Training, nutrition and body scores, exactly as docs/SCORES.md Parts 1 to 5
// (D-080). Pure: stored data in, scores and their parts out. Never combined
// into one number, never computed by the AI.

import type { Day, ItemFields, LoadUnit, Program, SectionKind } from '../types/program.ts'
import type { BodyEntry, DayChange, Goals, GoalType, MealDay, Session } from '../types/stores.ts'
import { BODY_FIELDS, convert, type BodyField } from './body.ts'
import { toISODate } from './dates.ts'
import { energyBand } from './nutrients.ts'
import { buildDeck, findEntry, findReferenceEntry, isEmptySession, isSetConfirmed, setRowsFor } from './session.ts'
import { addedDeckItems, effectiveDeckItem } from './sessionExercises.ts'
import { compareTopSets, topSet, type Change } from './summary.ts'
import { dayForDate, weekDates } from './program.ts'
import type { Targets } from './targets.ts'

// ── Part 1: weights, missing parts and rounding ──

export interface ScorePart {
  key: string
  /** MODELED weight, in percent. */
  weight: number
  /** 0 to 1; null when the part has no data (Part 1 rule 5). */
  value: number | null
}

/**
 * A part with no data drops out and the remaining weights are scaled up to
 * fill its share; the score is rounded to a whole number from 0 to 100. Null
 * when every part is missing.
 */
export function combine(parts: ScorePart[]): number | null {
  const present = parts.filter((p) => p.value !== null)
  const total = present.reduce((n, p) => n + p.weight, 0)
  if (present.length === 0 || total === 0) return null
  const raw = present.reduce((n, p) => n + (p.weight / total) * (p.value as number), 0)
  return Math.round(raw * 100)
}

/** The weights each part gets after missing parts drop out, in percent. */
export function effectiveWeights(parts: ScorePart[]): Record<string, number> {
  const present = parts.filter((p) => p.value !== null)
  const total = present.reduce((n, p) => n + p.weight, 0)
  return Object.fromEntries(present.map((p) => [p.key, total ? (p.weight / total) * 100 : 0]))
}

const ratio = (n: number, d: number): number | null => (d > 0 ? n / d : null)

// ── Part 2: training ──

export interface TrainingCounts {
  planned: number
  finished: number
  prescribed: number
  confirmed: number
  up: number
  same: number
  down: number
  /** Exercises logged this week with no comparable reference: listed, not counted. */
  newCount: number
}

/** First-ranked goal (D-030), or null with no goal set. */
export function mainGoal(goals: Goals | null | undefined): GoalType | null {
  if (!goals || goals.items.length === 0) return null
  return [...goals.items].sort((a, b) => a.rank - b.rank)[0].type
}

/** Same counts half when the main goal is build muscle or get stronger; otherwise, or with no goal, fully. */
export function sameValue(goal: GoalType | null): number {
  return goal === 'build_muscle' || goal === 'get_stronger' ? 0.5 : 1
}

export function trainingParts(c: TrainingCounts, goal: GoalType | null): ScorePart[] {
  const compared = c.up + c.same + c.down
  return [
    { key: 'adherence', weight: 40, value: ratio(c.finished, c.planned) },
    { key: 'completeness', weight: 30, value: ratio(c.confirmed, c.prescribed) },
    { key: 'progression', weight: 30, value: compared > 0 ? (c.up + c.same * sameValue(goal)) / compared : null },
  ]
}

/** Per-set items for completeness (D-013): main, block and abs, or `logged: true`; never check items. */
export function isPerSetItem(kind: SectionKind, resolved: ItemFields): boolean {
  if (resolved.type === 'check') return false
  if (resolved.logged !== undefined) return resolved.logged
  return kind === 'main' || kind === 'block' || kind === 'abs'
}

/**
 * A date is finished when a session of its current workout has ended and
 * holds at least one confirmed set or checked item (Part 2; D-075 rule 1;
 * an ended empty session does not count, D-086 rule 3).
 */
export function isFinishedSession(session: Session | undefined): boolean {
  return Boolean(session?.endedAt) && !isEmptySession(session as Session)
}

/** The dates of an app week counted so far: up to today for the current week (Part 1 rule 4). */
export function countedDates(dates: Date[], today: Date): Date[] {
  const todayIso = toISODate(today)
  return dates.filter((d) => toISODate(d) <= todayIso)
}

/** The training counts for one program week from stored data. */
export function trainingCounts(input: {
  program: Program
  changes: DayChange[]
  sessions: Session[]
  week: number
  today: Date
}): TrainingCounts {
  const { program, changes, sessions, week, today } = input
  const counts: TrainingCounts = { planned: 0, finished: 0, prescribed: 0, confirmed: 0, up: 0, same: 0, down: 0, newCount: 0 }
  const finishedSessions: { session: Session; day: Day }[] = []
  for (const date of countedDates(weekDates(program, week), today)) {
    const day = dayForDate(program, changes, date)
    if (day.rest) continue
    counts.planned += 1
    const iso = toISODate(date)
    const session = sessions.find((s) => s.date === iso && s.dayId === day.id)
    if (!isFinishedSession(session)) continue
    counts.finished += 1
    finishedSessions.push({ session: session!, day })
  }

  // Completeness over the per-set items of finished sessions; Discomfort skips left out.
  const latest = new Map<string, { session: Session; type: NonNullable<ItemFields['type']>; dayId: string }>()
  for (const { session, day } of finishedSessions) {
    const date = new Date(`${session.date}T12:00:00`)
    const deck = [...buildDeck(day, session.programWeek, date), ...addedDeckItems(session, program, day)].map((d) =>
      effectiveDeckItem(d, findEntry(session, d.item.id)),
    )
    for (const d of deck) {
      if (!isPerSetItem(d.section.kind, d.resolved)) continue
      const entry = findEntry(session, d.item.id)
      if (entry?.skipped || entry?.feltOff === 'discomfort') continue
      const rows = setRowsFor(d.resolved)
      counts.prescribed += rows.length
      const confirmed = (entry?.sets ?? []).filter(isSetConfirmed).length
      counts.confirmed += Math.min(confirmed, rows.length)
    }
    for (const entry of session.entries) {
      if (entry.skipped || !entry.sets.some(isSetConfirmed)) continue
      const d = deck.find((x) => x.item.id === entry.itemId)
      const type = d?.resolved.type ?? entry.fields?.type ?? 'load_reps'
      if (type === 'check') continue
      const seen = latest.get(entry.exerciseId)
      if (!seen || seen.session.date < session.date) latest.set(entry.exerciseId, { session, type, dayId: session.dayId })
    }
  }

  // Progression: each exercise's latest top set this week against its comparable reference (D-074 rules 4a and 5).
  for (const [exerciseId, { session, type, dayId }] of latest) {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)!
    const today = topSet(entry, type)
    if (!today) continue
    const before = sessions.filter((s) => s.date < session.date)
    const reference = findReferenceEntry(before, dayId, exerciseId, type)
    const last = reference ? topSet(reference, type) : undefined
    if (!last) {
      counts.newCount += 1
      continue
    }
    const change: Change = compareTopSets(today, last, type)
    counts[change] += 1
  }
  return counts
}

// ── Part 3: nutrition ──

export interface NutritionCounts {
  days: number
  logged: number
  inBand: number
  atProtein: number
  atFibre: number
  hasEnergyTarget: boolean
  hasProteinTarget: boolean
  hasFibreTarget: boolean
}

export function nutritionParts(c: NutritionCounts): ScorePart[] {
  return [
    { key: 'logging', weight: 25, value: ratio(c.logged, c.days) },
    { key: 'energy', weight: 35, value: c.hasEnergyTarget ? ratio(c.inBand, c.logged) : null },
    { key: 'protein', weight: 25, value: c.hasProteinTarget ? ratio(c.atProtein, c.logged) : null },
    { key: 'fibre', weight: 15, value: c.hasFibreTarget ? ratio(c.atFibre, c.logged) : null },
  ]
}

/** One day's nutrition result, for the charts and the counts. */
export interface NutritionDay {
  date: string
  logged: boolean
  kcal?: number
  proteinG?: number
  fibreG?: number
  sodiumMg?: number
  inBand?: boolean
  atProtein?: boolean
  atFibre?: boolean
}

/** A day with a parsed meal day counts as logged. */
export function isLoggedMealDay(day: MealDay | undefined): boolean {
  return Boolean(day?.parsed && day.parsed.items.length > 0)
}

export function nutritionDays(dates: string[], meals: MealDay[], targets: Targets, fibre: number | undefined): NutritionDay[] {
  const band = targets.kcal !== undefined ? energyBand(targets.kcal, targets.floor ?? 0) : undefined
  return dates.map((date) => {
    const day = meals.find((m) => m.date === date)
    if (!isLoggedMealDay(day)) return { date, logged: false }
    const p = day!.parsed!
    return {
      date,
      logged: true,
      kcal: p.kcal,
      proteinG: p.proteinG,
      ...(p.fibreG !== undefined ? { fibreG: p.fibreG } : {}),
      ...(p.sodiumMg !== undefined ? { sodiumMg: p.sodiumMg } : {}),
      // A day below the floor is never in range (Part 1 rule 2): the band starts at the floor.
      ...(band ? { inBand: p.kcal >= band.low && p.kcal <= band.high } : {}),
      ...(targets.proteinG !== undefined ? { atProtein: p.proteinG >= targets.proteinG } : {}),
      ...(fibre !== undefined ? { atFibre: (p.fibreG ?? 0) >= fibre } : {}),
    }
  })
}

export function nutritionCounts(days: NutritionDay[], targets: Targets, fibre: number | undefined): NutritionCounts {
  const logged = days.filter((d) => d.logged)
  return {
    days: days.length,
    logged: logged.length,
    inBand: logged.filter((d) => d.inBand).length,
    atProtein: logged.filter((d) => d.atProtein).length,
    atFibre: logged.filter((d) => d.atFibre).length,
    hasEnergyTarget: targets.kcal !== undefined,
    hasProteinTarget: targets.proteinG !== undefined,
    hasFibreTarget: fibre !== undefined,
  }
}

// ── Part 5: body ──

export type BodyMeasure = 'bodyFatMass' | 'skeletalMuscle' | 'bodyFatPct' | 'weight'

/** The measures scored for a first-ranked goal; empty means trends only. */
export function bodyMeasures(goals: Goals | null | undefined): BodyMeasure[] {
  if (!goals || goals.items.length === 0) return []
  const ranked = [...goals.items].sort((a, b) => a.rank - b.rank)
  const first = ranked[0].type
  if (first === 'lose_fat') return ranked[1]?.type === 'build_muscle' ? ['bodyFatMass', 'skeletalMuscle'] : ['bodyFatMass', 'bodyFatPct']
  if (first === 'build_muscle') return ['skeletalMuscle']
  // Lose weight: the weight band is OPEN (D-080 rule 5), so trends only for now.
  return []
}

/** Noise bands (Part 5): percentage points for body fat %, otherwise in the display unit. */
export function noiseBand(measure: BodyMeasure, units: LoadUnit): number | null {
  switch (measure) {
    case 'bodyFatPct':
      return 1.0
    case 'bodyFatMass':
      return units === 'lb' ? 1.5 : 0.7
    case 'skeletalMuscle':
      // PROXY: the source measured fat-free mass (0.9 kg); labelled as a proxy until sourced.
      return units === 'lb' ? 2.0 : 0.9
    case 'weight':
      return null
  }
}

/** Fat measures go down, muscle goes up. */
export function goalDirection(measure: BodyMeasure): 1 | -1 {
  return measure === 'skeletalMuscle' ? 1 : -1
}

/** Beyond the band in the goal's direction = 1; within it = 0.5; beyond it against the goal = 0. */
export function measureScore(change: number, band: number, direction: 1 | -1): number {
  const rounded = Math.round(change * 100) / 100
  if (Math.abs(rounded) <= band) return 0.5
  return Math.sign(rounded) === direction ? 1 : 0
}

const DAY_MS = 86_400_000
const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY_MS

export interface BodyComparison {
  latest: BodyEntry
  reference: BodyEntry
  measures: { measure: BodyMeasure; change: number; band: number; value: number; beyond: boolean }[]
}

/**
 * The latest entry against the entry dated 21 to 35 days earlier, the one
 * closest to 28 days when there are several. Only the goal's measures that
 * both entries hold are compared.
 */
export function bodyComparison(entries: BodyEntry[], measures: BodyMeasure[], units: LoadUnit, asOf?: string): BodyComparison | null {
  if (measures.length === 0) return null
  const has = (e: BodyEntry) => measures.some((m) => e[m] !== undefined)
  const sorted = entries.filter((e) => (asOf ? e.date <= asOf : true) && has(e)).sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  if (!latest) return null
  const candidates = sorted
    .filter((e) => {
      const gap = dayNumber(latest.date) - dayNumber(e.date)
      return gap >= 21 && gap <= 35
    })
    .sort((a, b) => Math.abs(dayNumber(latest.date) - dayNumber(a.date) - 28) - Math.abs(dayNumber(latest.date) - dayNumber(b.date) - 28))
  const reference = candidates[0]
  if (!reference) return null
  const kindOf = (m: BodyField) => BODY_FIELDS.find((f) => f.field === m)!.kind
  const out: BodyComparison['measures'] = []
  for (const measure of measures) {
    const a = latest[measure]
    const b = reference[measure]
    const band = noiseBand(measure, units)
    if (a === undefined || b === undefined || band === null) continue
    const now = convert(a, kindOf(measure), latest.units, units)
    const then = convert(b, kindOf(measure), reference.units, units)
    const change = Math.round((now - then) * 10) / 10
    out.push({ measure, change, band, value: measureScore(change, band, goalDirection(measure)), beyond: Math.abs(change) > band })
  }
  return out.length ? { latest, reference, measures: out } : null
}

/** The body score: the average of the measures × 100; null without a comparison. */
export function bodyScore(comparison: BodyComparison | null): number | null {
  if (!comparison) return null
  return Math.round((comparison.measures.reduce((n, m) => n + m.value, 0) / comparison.measures.length) * 100)
}

// ── Helpers for the views ──

export interface WeekScore {
  week: number
  score: number | null
}

/** Training scores for program weeks 1 to `upTo`, for the trend. */
export function trainingTrend(input: { program: Program; changes: DayChange[]; sessions: Session[]; goals: Goals | null; today: Date; upTo: number }): WeekScore[] {
  const goal = mainGoal(input.goals)
  return Array.from({ length: Math.max(0, input.upTo) }, (_, i) => {
    const week = i + 1
    return { week, score: combine(trainingParts(trainingCounts({ ...input, week }), goal)) }
  })
}

/** A short sentence comparing a week's score with the one before. */
export function trendSentence(score: number | null, previous: number | null): string {
  if (score === null) return 'No score this week.'
  const lead = score >= 80 ? 'A strong week' : score >= 60 ? 'A steady week' : 'A lighter week'
  if (previous === null) return `${lead}.`
  const diff = score - previous
  if (diff === 0) return `${lead}, level with the one before.`
  return `${lead}, ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} on the one before.`
}
