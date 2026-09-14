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
