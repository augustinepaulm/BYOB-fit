// Exercise history for the Log screen (task 13).

import type { Session, SetLog } from '../types/stores.ts'
import { isSetConfirmed } from './session.ts'

export interface ExerciseSession {
  date: string
  dayId: string
  sets: SetLog[]
}

/** Confirmed sets per exercise, newest session first. */
export function buildExerciseLog(
  sessions: Session[],
): Map<string, ExerciseSession[]> {
  const byExercise = new Map<string, ExerciseSession[]>()
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  for (const session of ordered) {
    for (const entry of session.entries) {
      const sets = entry.sets.filter(isSetConfirmed)
      if (sets.length === 0) continue
      const list = byExercise.get(entry.exerciseId) ?? []
      const existing = list.find((item) => item.date === session.date)
      if (existing) existing.sets.push(...sets)
      else list.push({ date: session.date, dayId: session.dayId, sets })
      byExercise.set(entry.exerciseId, list)
    }
  }
  return byExercise
}

/**
 * Best set: heaviest by weight and then reps; for holds the longest, for
 * distance the furthest, otherwise the most reps or minutes.
 */
export function bestSetOf(sets: SetLog[]): SetLog | undefined {
  const confirmed = sets.filter(isSetConfirmed)
  if (confirmed.length === 0) return undefined

  const loaded = confirmed.filter((set) => set.weight !== undefined)
  if (loaded.length > 0) {
    return loaded.reduce((best, set) => {
      const bw = best.weight ?? 0
      const sw = set.weight ?? 0
      if (sw !== bw) return sw > bw ? set : best
      return (set.reps ?? 0) > (best.reps ?? 0) ? set : best
    })
  }
  const pick = (key: 'seconds' | 'distanceM' | 'reps' | 'minutes') => {
    const candidates = confirmed.filter((set) => set[key] !== undefined)
    if (candidates.length === 0) return undefined
    return candidates.reduce((best, set) =>
      (set[key] ?? 0) > (best[key] ?? 0) ? set : best,
    )
  }
  return pick('seconds') ?? pick('distanceM') ?? pick('reps') ?? pick('minutes')
}

/** Top-set weight per session, oldest first, for the sparkline. */
export function topSetSeries(
  history: ExerciseSession[],
): { date: string; value: number }[] {
  return [...history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => {
      const best = bestSetOf(item.sets)
      const value =
        best?.weight ??
        best?.seconds ??
        best?.distanceM ??
        best?.reps ??
        best?.minutes
      return value === undefined ? null : { date: item.date, value }
    })
    .filter((point): point is { date: string; value: number } => point !== null)
}

/** Whole weeks spanned by a series, for the sparkline caption. */
export function weeksSpanned(points: { date: string }[]): number {
  if (points.length === 0) return 0
  const first = new Date(points[0].date).getTime()
  const last = new Date(points[points.length - 1].date).getTime()
  return Math.max(1, Math.ceil((last - first) / (7 * 86_400_000)) || 1)
}

// ── Week against week (frame 3i) ──

/** Program weeks in which an exercise has confirmed sets, newest first. */
export function weeksWithExercise(sessions: Session[], exerciseId: string): number[] {
  const weeks = new Set<number>()
  for (const session of sessions) {
    if (session.entries.some((e) => e.exerciseId === exerciseId && e.sets.some(isSetConfirmed))) {
      weeks.add(session.programWeek)
    }
  }
  return [...weeks].sort((a, b) => b - a)
}

/** An exercise's confirmed sets in one program week, in session and set order. */
export function setsInWeek(sessions: Session[], exerciseId: string, week: number): SetLog[] {
  return [...sessions]
    .filter((s) => s.programWeek === week)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((s) => s.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter(isSetConfirmed)))
}

/** Defaults: the latest week with this exercise, and the one before it. */
export function defaultWeeks(weeks: number[]): { from: number | null; to: number | null } {
  return { to: weeks[0] ?? null, from: weeks[1] ?? null }
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/**
 * The change between two weeks' best sets, e.g. "+2.5 kg on the best set,
 * same reps". Weighted sets compare weight, then reps.
 */
export function bestSetChange(from: SetLog | undefined, to: SetLog | undefined, unit: string): string | null {
  if (!from || !to) return null
  if (from.weight !== undefined && to.weight !== undefined) {
    const dw = to.weight - from.weight
    const weight = dw > 0 ? `+${trim(dw)} ${unit}` : dw < 0 ? `−${trim(-dw)} ${unit}` : 'Same weight'
    const dr = (to.reps ?? 0) - (from.reps ?? 0)
    const reps = dr === 0 ? 'same reps' : dr > 0 ? `${dr} more ${dr === 1 ? 'rep' : 'reps'}` : `${-dr} fewer ${dr === -1 ? 'rep' : 'reps'}`
    return `${weight} on the best set, ${reps}`
  }
  for (const [key, label] of [['seconds', 's'], ['distanceM', 'm'], ['reps', 'reps'], ['minutes', 'min']] as const) {
    const a = from[key]
    const b = to[key]
    if (a !== undefined && b !== undefined) {
      const d = b - a
      return d === 0 ? 'Same as the week before' : `${d > 0 ? '+' : '−'}${trim(Math.abs(d))} ${label} on the best set`
    }
  }
  return null
}
