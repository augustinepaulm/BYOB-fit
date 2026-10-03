// Chart data for Progress (D-071 rule 2, D-080). Pure; the views draw it as inline SVG.

import type { Muscle, Program } from '../types/program.ts'
import type { BodyEntry, Session, SetLog } from '../types/stores.ts'
import { resolveItem } from './program.ts'
import { isSetConfirmed } from './session.ts'

/**
 * D-071 rule 2 (DEFAULT): Epley, weight × (1 + reps ÷ 30), on the best set of
 * each session; a single rep counts as its weight; sets above 12 reps are left out.
 */
export function epley(set: SetLog): number | undefined {
  if (set.weight === undefined || set.reps === undefined || set.reps < 1 || set.reps > 12) return undefined
  return set.reps === 1 ? set.weight : set.weight * (1 + set.reps / 30)
}

/** Each finished session's estimated one-rep max for an exercise, oldest first. */
export function oneRepMaxSeries(sessions: Session[], exerciseId: string): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = []
  for (const session of [...sessions].filter((s) => s.endedAt).sort((a, b) => a.date.localeCompare(b.date))) {
    let best: number | undefined
    for (const entry of session.entries) {
      if (entry.exerciseId !== exerciseId) continue
      for (const set of entry.sets.filter(isSetConfirmed)) {
        const e = epley(set)
        if (e !== undefined && (best === undefined || e > best)) best = e
      }
    }
    if (best !== undefined) out.push({ date: session.date, value: Math.round(best * 10) / 10 })
  }
  return out
}

export const NOT_TAGGED = 'not tagged'

/** Working sets per muscle group in the given sessions; exercises without muscles count under "not tagged". */
export function setsPerMuscle(sessions: Session[], program: Program | null): { muscle: Muscle | typeof NOT_TAGGED; sets: number }[] {
  const counts = new Map<string, number>()
  for (const session of sessions) {
    for (const entry of session.entries) {
      const sets = entry.sets.filter(isSetConfirmed).length
      if (sets === 0) continue
      const muscles = program?.exercises[entry.exerciseId]?.muscles ?? []
      for (const muscle of muscles.length ? muscles : [NOT_TAGGED]) counts.set(muscle, (counts.get(muscle) ?? 0) + sets)
    }
  }
  return [...counts.entries()]
    .map(([muscle, sets]) => ({ muscle: muscle as Muscle | typeof NOT_TAGGED, sets }))
    .sort((a, b) => (a.muscle === NOT_TAGGED ? 1 : b.muscle === NOT_TAGGED ? -1 : b.sets - a.sets))
}

const dayNo = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000

/** Weight with a trailing 7-day average: the mean of the weigh-ins in the 7 days ending on each date. */
export function sevenDayAverage(points: { date: string; value: number }[]): { date: string; value: number }[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((p) => {
    const window = sorted.filter((q) => dayNo(q.date) <= dayNo(p.date) && dayNo(q.date) > dayNo(p.date) - 7)
    return { date: p.date, value: Math.round((window.reduce((n, q) => n + q.value, 0) / window.length) * 10) / 10 }
  })
}

/** One body field over time, in its stored units converted by the caller's function. */
export function bodySeries(entries: BodyEntry[], read: (e: BodyEntry) => number | undefined): { date: string; value: number }[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((e) => {
      const v = read(e)
      return v === undefined ? [] : [{ date: e.date, value: v }]
    })
}

/** Exercise ids the program marks as index lifts for the current week. */
export function indexExerciseIds(program: Program, week: number): Set<string> {
  const ids = new Set<string>()
  for (const day of program.days) {
    for (const section of day.sections) {
      for (const item of section.items) {
        const resolved = resolveItem(item, week)
        if (resolved.index && resolved.exerciseId) ids.add(resolved.exerciseId)
      }
    }
  }
  return ids
}
