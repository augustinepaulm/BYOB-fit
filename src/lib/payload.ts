// What each model call sends (D-031, D-044). One function builds both the
// preview (frames 4h, 4i) and the request, so the preview is what is sent.
// Pure: no storage, no clock.

import type { Program } from '../types/program.ts'
import type { BodyEntry, Goals, MealFood, PrivacyLevel, ProgressView, Session, Settings } from '../types/stores.ts'
import { fromGoals, goalSummary } from './goals.ts'
import { compactSessions } from './reprogram.ts'

export type CallKind = 'review' | 'update' | 'meals' | 'week_note'

/** D-081, D-084 rule 2: what a week review carries besides the program data. */
export interface WeekReviewData {
  view: ProgressView
  /** The Sunday that starts the week, YYYY-MM-DD. */
  weekStart: string
  programWeek?: number
  /** The week's score, or null when there is none yet. */
  score: number | null
  /** Each part as shown, in words, with its weight. */
  parts: { label: string; value: string; weight?: number }[]
  /** The week's underlying data for the view, already reduced to what may be sent. */
  data: unknown
}

export interface SummaryLine {
  label: string
  value: string
}

export interface Payload {
  summary: SummaryLine[]
  /** The exact user message sent; the request carries nothing else of the user's. */
  message: string
}

export interface PayloadData {
  program?: Program | null
  /** Sessions the call may use: the current week for an update, the program's for a review. */
  sessions?: Session[]
  goals?: Goals | null
  rules?: string
  settings?: Settings
  /** Update: the program week the patch is for. */
  week?: number
  /** Update: day ids already started this week. */
  startedDayIds?: string[]
  /** Meals: only the lines that need the model (D-049 rule 3), the user's foods, and the free-text notes. */
  mealLines?: string[]
  mealFoods?: MealFood[]
  mealBaseline?: string
  /** D-078 rule 4, D-084 rule 2: body entries go at every level. */
  bodyEntries?: BodyEntry[]
  /** D-081: the week being reviewed. */
  weekReview?: WeekReviewData
}

export const LEVEL_LABEL: Record<PrivacyLevel, string> = {
  minimal: 'Minimal',
  standard: 'Standard',
  full: 'Full',
}

export const CALL_LABEL: Record<CallKind, string> = {
  review: 'AI review of your program',
  update: 'Program update',
  meals: 'Meal estimate',
  week_note: 'Review this week',
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function linesOf(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

/** D-044: the program without its top-level notes, unless notes are opted in. */
function programFor(program: Program, withNotes: boolean): Program {
  if (withNotes) return program
  const copy = { ...program }
  delete copy.notes
  return copy
}

/** Structured goal: types, targets, timeframe, start date. Never currentStats. */
function goalFor(goals: Goals | null | undefined) {
  if (!goals) return null
  return {
    items: goals.items,
    timeframeWeeks: goals.timeframeWeeks,
    startDate: goals.startDate,
  }
}

function sessionsFor(sessions: Session[], withNotes: boolean) {
  return compactSessions(sessions).map((session) => ({
    ...session,
    entries: session.entries.map((entry) => {
      if (withNotes) return entry
      const copy = { ...entry }
      delete copy.note
      return copy
    }),
  }))
}

/** D-084 rule 2: every D-078 field with its date; nothing else of the record. */
export function bodyEntriesFor(entries: BodyEntry[]): Omit<BodyEntry, 'updatedAt'>[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => {
      const copy: Partial<BodyEntry> = { ...entry }
      delete copy.updatedAt
      return copy as Omit<BodyEntry, 'updatedAt'>
    })
}

function confirmedSetCount(sessions: Session[]): number {
  return compactSessions(sessions).reduce(
    (n, s) => n + s.entries.reduce((m, e) => m + (e.sets?.length ?? 0), 0),
    0,
  )
}

export function buildPayload(
  kind: CallKind,
  level: PrivacyLevel,
  includeNotes: boolean,
  data: PayloadData,
): Payload {
  // Notes travel only at Full, and only when switched on.
  const withNotes = level === 'full' && includeNotes

  if (kind === 'meals') {
    const lines = data.mealLines ?? []
    // D-079 rule 1: a food's own nutrient values go with it, so the model can use them.
    const foods = (data.mealFoods ?? []).map((f) => {
      const food: MealFood = { name: f.name, kcal: f.kcal }
      for (const key of ['proteinG', 'carbsG', 'fatG', 'fibreG', 'sodiumMg', 'addedSugarG', 'satFatG'] as const) if (f[key] !== undefined) food[key] = f[key]
      return food
    })
    const baseline = data.mealBaseline?.trim() ?? ''
    return {
      summary: [
        { label: 'Meal lines', value: count(lines.length, 'line') },
        { label: 'Your foods', value: foods.length ? count(foods.length, 'food') : 'None' },
        { label: 'Notes', value: baseline ? count(linesOf(baseline).length, 'line') : 'Not set' },
      ],
      message: JSON.stringify({ baseline, foods, lines }, null, 2),
    }
  }

  const program = data.program
  const sessions = data.sessions ?? []
  const rules = data.rules ?? ''
  const training = program?.days.filter((d) => !d.rest) ?? []
  const items = training.reduce(
    (n, d) => n + d.sections.reduce((m, s) => m + s.items.filter((i) => !i.retiredFrom).length, 0),
    0,
  )
  const goalText = data.goals
    ? goalSummary(fromGoals(data.goals), data.goals.timeframeWeeks, (id) => program?.exercises[id]?.name).replace(/\.$/, '')
    : 'No goal set'
  const sets = confirmedSetCount(sessions)
  const summary: SummaryLine[] = [
    { label: 'Program', value: `${count(training.length, 'training day')}, ${count(items, 'exercise')}` },
    { label: 'Logged', value: `${count(sets, 'set')} from ${count(sessions.length, 'session')}` },
    { label: 'Goal', value: goalText },
    { label: 'Your training rules', value: linesOf(rules).length ? count(linesOf(rules).length, 'line') : 'None' },
  ]

  const message: Record<string, unknown> = { task: kind }
  if (kind === 'update') {
    message.week = data.week
    message.startedDayIds = data.startedDayIds ?? []
  }
  if (kind === 'week_note' && data.weekReview) {
    const review = data.weekReview
    // D-084 rule 2: the week's score and its parts, at every level.
    message.view = review.view
    message.weekStart = review.weekStart
    if (review.programWeek !== undefined) message.programWeek = review.programWeek
    message.score = review.score
    message.parts = review.parts
    message.weekData = review.data
    summary.unshift(
      { label: 'Week', value: `${review.view[0].toUpperCase()}${review.view.slice(1)}, week of ${review.weekStart}` },
      { label: 'Score', value: review.score === null ? 'None yet' : `${review.score} and its ${count(review.parts.length, 'part')}` },
    )
  }
  message.rules = rules.trim() === '' ? 'No rules supplied.' : rules
  message.goal = goalFor(data.goals)
  // D-084 rule 2: body entries, every field with its date, at every level.
  const body = bodyEntriesFor(data.bodyEntries ?? [])
  message.bodyEntries = body
  summary.push({ label: 'Body entries', value: body.length ? count(body.length, 'entry', 'entries') : 'None' })

  if (level === 'standard' || level === 'full') {
    const experience = data.settings?.onboarding?.experience ?? null
    message.experience = experience
    summary.push({ label: 'Experience level', value: experience === 'new' ? 'New' : experience === 'experienced' ? 'Experienced' : 'Not set' })
    // D-048: item id and flag only, from the sessions being sent.
    const feltOff = sessions.flatMap((session) =>
      session.entries.filter((e) => e.feltOff).map((e) => ({ itemId: e.itemId, flag: e.feltOff })),
    )
    message.feltOff = feltOff
    summary.push({ label: 'Felt off', value: feltOff.length ? String(feltOff.length) : 'None' })
  }
  if (level === 'full') {
    const stats = data.goals?.currentStats
    const weight = stats?.weight !== undefined ? { value: stats.weight, unit: stats.weightUnit ?? 'kg' } : null
    message.currentWeight = weight
    summary.push({ label: 'Current weight', value: weight ? `${weight.value} ${weight.unit}` : 'Not set' })
    summary.push({ label: 'Notes', value: withNotes ? 'Session and program notes included' : 'Not included' })
  }

  message.logged = sessionsFor(sessions, withNotes)
  message.program = program ? programFor(program, withNotes) : null
  return { summary, message: JSON.stringify(message, null, 2) }
}

/** The sent log keeps the summary as one line of text. */
export function joinSummary(summary: SummaryLine[]): string {
  return summary.map((line) => `${line.label}: ${line.value}`).join(' · ')
}

/** The three levels as frames 1k and 5e list them. */
export const PRIVACY_LEVELS: { value: PrivacyLevel; title: string; sub: string }[] = [
  { value: 'minimal', title: 'Minimal', sub: 'Your workouts, program and goal' },
  { value: 'standard', title: 'Standard', sub: 'Adds experience level and "felt off" flags' },
  // D-084 rule 1: age range and sex are never sent (O-11).
  { value: 'full', title: 'Full', sub: 'Adds current weight' },
]
