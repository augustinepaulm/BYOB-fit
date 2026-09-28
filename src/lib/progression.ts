// Progression suggestion (D-047, docs/TARGETS-AND-PROGRESSION.md Part 2).
// Pure: the deck asks, the user decides; the chip never applies itself.

import type { Exercise, ItemFields, LoadUnit, Muscle, Progression } from '../types/program.ts'
import type { Entry, SetLog } from '../types/stores.ts'
import { isSetConfirmed } from './session.ts'

export type Suggestion =
  | { kind: 'weight'; to: number; sessions: number; sets: number; reps: number }
  | { kind: 'reps' }
  | null

const BIG: Muscle[] = ['legs', 'glutes', 'back', 'chest']
const LOADED = ['barbell', 'machine', 'cable']

/** 5% for big muscles on a barbell, machine or cable; 2.5% otherwise or without metadata. */
export function defaultPercent(exercise: Exercise | undefined): number {
  const big = exercise?.muscles?.some((m) => BIG.includes(m)) ?? false
  const loaded = exercise?.equipment !== undefined && LOADED.includes(exercise.equipment)
  return big && loaded ? 5 : 2.5
}

/** Barbell, machine, cable 2.5 kg or 5 lb; dumbbell 2 kg or 5 lb; else 2.5 kg or 5 lb. */
export function defaultStep(exercise: Exercise | undefined, unit: LoadUnit): number {
  if (unit === 'lb') return 5
  return exercise?.equipment === 'dumbbell' ? 2 : 2.5
}

/** The nearest multiple of step to raw, at least one step; a tie takes the smaller. */
export function stepsFor(raw: number, step: number): number {
  const below = Math.floor(raw / step + 1e-9)
  const rest = raw - below * step
  const k = rest > step / 2 + 1e-9 ? below + 1 : below
  return Math.max(1, k)
}

function working(entry: Entry): SetLog[] {
  return entry.sets.filter(isSetConfirmed)
}

/**
 * `history` is this item's recent entries, newest first. Suggests more weight
 * after N sessions in which every working set reached repMax at one weight.
 */
export function suggestProgression(
  /** The item as resolved for this week; progression comes from the base item. */
  item: ItemFields & { progression?: Progression },
  exercise: Exercise | undefined,
  history: Entry[],
  unit: LoadUnit,
): Suggestion {
  if (item.type !== 'load_reps' || item.repMax === undefined) return null
  const n = item.progression?.sessions ?? 2
  const recent = history.slice(0, n)
  if (recent.length < n) return null

  let load: number | undefined
  const minSets = item.sets ?? 1
  for (const entry of recent) {
    const sets = working(entry)
    if (sets.length < minSets) return null
    for (const set of sets) {
      if (set.weight === undefined || set.reps === undefined) return null
      if (set.reps < item.repMax) return null
      if (load === undefined) load = set.weight
      else if (set.weight !== load) return null
    }
  }
  if (load === undefined || load <= 0) return null

  const percent = item.progression?.percent ?? defaultPercent(exercise)
  const step = item.progression?.step ?? defaultStep(exercise, unit)
  if (step > load * 0.1) return { kind: 'reps' }

  const k = stepsFor((load * percent) / 100, step)
  const latest = working(recent[0])
  return {
    kind: 'weight',
    to: Math.round((load + k * step) * 100) / 100,
    sessions: n,
    sets: latest.length,
    reps: Math.min(...latest.map((s) => s.reps ?? 0)),
  }
}

/** The chip's words (D-047, frame 3b as amended). */
export function suggestionText(s: Exclude<Suggestion, null>): string {
  return s.kind === 'reps'
    ? 'Aim for more reps at this weight.'
    : `Try ${s.to}, you hit ${s.sets} × ${s.reps} in your last ${s.sessions} sessions.`
}
