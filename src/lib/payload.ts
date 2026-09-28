// What each model call sends (D-031, D-044). One function builds both the
// preview (frames 4h, 4i) and the request, so the preview is what is sent.
// Pure: no storage, no clock.

import type { Program } from '../types/program.ts'
import type { Goals, PrivacyLevel, Session, Settings } from '../types/stores.ts'
import { fromGoals, goalSummary } from './goals.ts'
import { compactSessions } from './reprogram.ts'

export type CallKind = 'review' | 'update' | 'meals'

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
  /** Meals: the day's lines and the user's baseline description. */
  mealLines?: string[]
  mealBaseline?: string
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
    const baseline = data.mealBaseline?.trim() ?? ''
    return {
      summary: [
        { label: 'Meal lines', value: count(lines.length, 'line') },
        { label: 'Your baseline', value: baseline ? count(linesOf(baseline).length, 'line') : 'Not set' },
      ],
      message: JSON.stringify({ baseline, lines }, null, 2),
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
  message.rules = rules.trim() === '' ? 'No rules supplied.' : rules
  message.goal = goalFor(data.goals)

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
  { value: 'full', title: 'Full', sub: 'Adds age range, sex and current weight' },
]
