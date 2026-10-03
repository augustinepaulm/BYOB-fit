// The session summary's comparison with last week and its progression list
// (D-074 rule 4). Pure functions: no storage, no DOM.

import type { Exercise, ItemType } from '../types/program.ts'
import type { Entry, Session, SetLog } from '../types/stores.ts'
import { suggestProgression, suggestionText } from './progression.ts'
import { findEntry, findReferenceEntry, isSetConfirmed, type DeckItem } from './session.ts'
import { progressionHistory } from './sessionExercises.ts'

export type Change = 'up' | 'same' | 'down'

export interface UpLine {
  exerciseId: string
  /** Today's top set and last week's, with units, such as "120 lb × 10". */
  today: string
  last: string
}

export interface LastWeekComparison {
  up: number
  same: number
  down: number
  upLines: UpLine[]
  /** Exercises with no comparable entry before today: listed, not counted. */
  newIds: string[]
}

/** The value a set is compared on, by type: [main, tie-break]. */
function score(set: SetLog, type: ItemType): [number, number] {
  switch (type) {
    case 'load_reps':
      return [set.weight ?? 0, set.reps ?? 0]
    case 'timed_hold':
      return [set.seconds ?? 0, 0]
    case 'distance':
      return [set.distanceM ?? 0, 0]
    case 'cardio_block':
      return [set.minutes ?? 0, 0]
    default:
      return [set.reps ?? 0, 0]
  }
}

/** The top set of an entry: heaviest then most reps; for other types the largest value. */
export function topSet(entry: Entry, type: ItemType): SetLog | undefined {
  const sets = entry.sets.filter(isSetConfirmed).filter((set) => type !== 'load_reps' || set.weight !== undefined)
  let best: SetLog | undefined
  for (const set of sets) {
    if (!best) {
      best = set
      continue
    }
    const [a1, a2] = score(set, type)
    const [b1, b2] = score(best, type)
    if (a1 > b1 || (a1 === b1 && a2 > b2)) best = set
  }
  return best
}

/** A heavier weight is up; the same weight with more reps is up; other types compare their one value. */
export function compareTopSets(today: SetLog, last: SetLog, type: ItemType): Change {
  const [t1, t2] = score(today, type)
  const [l1, l2] = score(last, type)
  if (t1 > l1 || (t1 === l1 && t2 > l2)) return 'up'
  if (t1 === l1 && t2 === l2) return 'same'
  return 'down'
}

/** A set as the summary writes it, with its unit. */
export function setText(set: SetLog, type: ItemType, unit: string): string {
  switch (type) {
    case 'load_reps':
      return `${set.weight} ${unit} × ${set.reps}`
    case 'timed_hold':
      return `${set.seconds} s`
    case 'distance':
      return `${set.distanceM} m`
    case 'cardio_block':
      return `${set.minutes} min`
    default:
      return `${set.reps} reps`
  }
}

/**
 * "Compared with last week": each logged exercise's top set today against its
 * top set in the reference entry (D-074 rule 5). `history` is every stored
 * session; this session is left out of it.
 */
export function compareWithLastWeek(session: Session | undefined, deck: DeckItem[], history: Session[], dayId: string): LastWeekComparison {
  const result: LastWeekComparison = { up: 0, same: 0, down: 0, upLines: [], newIds: [] }
  const before = history.filter((s) => s.id !== session?.id)
  for (const deckItem of deck) {
    if (!deckItem.logged) continue
    const type = deckItem.resolved.type ?? 'load_reps'
    if (type === 'check') continue
    const entry = findEntry(session, deckItem.item.id)
    if (!entry || entry.skipped) continue
    const today = topSet(entry, type)
    if (!today) continue
    const reference = findReferenceEntry(before, dayId, entry.exerciseId, type)
    const last = reference ? topSet(reference, type) : undefined
    if (!last) {
      result.newIds.push(entry.exerciseId)
      continue
    }
    const change = compareTopSets(today, last, type)
    result[change] += 1
    if (change === 'up') {
      const unit = deckItem.resolved.unit ?? 'kg'
      result.upLines.push({ exerciseId: entry.exerciseId, today: setText(today, type, unit), last: setText(last, type, unit) })
    }
  }
  return result
}

/**
 * "Ready to progress": exercises where the progression suggestion (D-047,
 * D-055) fires with this session counted as the latest, with its words.
 * Entries logged with their own prescription do not count (D-069 rule 9).
 */
export function readyToProgress(
  session: Session | undefined,
  deck: DeckItem[],
  history: Session[],
  exerciseOf: (exerciseId: string) => Exercise | undefined,
): { exerciseId: string; text: string }[] {
  if (!session) return []
  const before = history.filter((s) => s.id !== session.id)
  const out: { exerciseId: string; text: string }[] = []
  for (const deckItem of deck) {
    const entry = findEntry(session, deckItem.item.id)
    if (!entry || entry.changed || entry.added || entry.skipped) continue
    if (!entry.sets.some(isSetConfirmed)) continue
    const past = progressionHistory(before, deckItem.item.id, entry.exerciseId, session.date)
    const suggestion = suggestProgression(
      { ...deckItem.resolved, progression: deckItem.item.progression },
      exerciseOf(entry.exerciseId),
      [entry, ...past],
      deckItem.resolved.unit ?? 'kg',
    )
    if (suggestion) out.push({ exerciseId: entry.exerciseId, text: suggestionText(suggestion) })
  }
  return out
}
