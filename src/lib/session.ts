// Session shape and rules (EXEC-03 tasks 6, 8, 11). Pure functions only.

import type { Day, Item, ItemFields, ItemType, Section } from '../types/program.ts'
import type { Entry, Session, SetLog } from '../types/stores.ts'
import { isActiveOn, isLogged, resolveItem } from './program.ts'

export interface DeckItem {
  /** 1-based position across the whole session, for "item N of M". */
  position: number
  section: Section
  item: Item
  resolved: ItemFields & { id: string }
  logged: boolean
}

/**
 * Every item of a day active on `date`, in section order, resolved for the
 * program week. Items retired on or before the date are left out (D-028).
 */
export function buildDeck(day: Day, week: number, date: Date): DeckItem[] {
  const deck: DeckItem[] = []
  for (const section of day.sections) {
    for (const item of section.items) {
      if (!isActiveOn(item, date)) continue
      const resolved = resolveItem(item, week)
      deck.push({
        position: deck.length + 1,
        section,
        item,
        resolved,
        logged: isLogged(section.kind, resolved),
      })
    }
  }
  return deck
}

/**
 * D-075 rule 3: the session End stores, or null when there is nothing to
 * write. Ending never creates a session, and a session keeps its first end time.
 */
export function sessionToEnd(stored: Session | null | undefined, now: Date): Session | null {
  if (!stored || stored.endedAt) return null
  return { ...stored, endedAt: now.toISOString() }
}

/**
 * D-086: a session with no confirmed set and no checked item holds nothing,
 * so ending it deletes it instead and the date stays open.
 */
export function isEmptySession(session: Session): boolean {
  return !session.entries.some((entry) => entry.checked === true || entry.sets.some(isSetConfirmed))
}

/** What ending a session does: nothing, delete it (D-086), or store it ended. */
export type EndOutcome = { kind: 'none' } | { kind: 'delete'; session: Session } | { kind: 'end'; session: Session }

/** End (D-075 rule 3, D-086): never creates a session or moves an end time; an empty one is deleted. */
export function endOutcome(stored: Session | null | undefined, now: Date): EndOutcome {
  const next = sessionToEnd(stored, now)
  if (!next) return { kind: 'none' }
  return isEmptySession(next) ? { kind: 'delete', session: next } : { kind: 'end', session: next }
}

/**
 * Finish and the mid-workout Change (D-069 rule 4, D-086): nothing stored
 * means nothing to end; an open session with nothing in it is deleted; an
 * end time already set stays.
 */
export function finishOutcome(stored: Session | null | undefined, now: Date): EndOutcome {
  if (!stored) return { kind: 'none' }
  if (!stored.endedAt && isEmptySession(stored)) return { kind: 'delete', session: stored }
  return { kind: 'end', session: stored.endedAt ? stored : { ...stored, endedAt: now.toISOString() } }
}

/** One session per (date, dayId): the pair is the key. */
export function sessionIdFor(date: string, dayId: string): string {
  return `${date}__${dayId}`
}

export interface SetRow {
  n: number
  side?: 'L' | 'R'
}

/** Rows for one item; per-side items get an L and an R row per set. */
export function setRowsFor(resolved: ItemFields): SetRow[] {
  const sets = Math.max(1, resolved.sets ?? 1)
  const rows: SetRow[] = []
  for (let n = 1; n <= sets; n++) {
    if (resolved.perSide) {
      rows.push({ n, side: 'L' })
      rows.push({ n, side: 'R' })
    } else {
      rows.push({ n })
    }
  }
  return rows
}

export function sameRow(set: SetLog, row: SetRow): boolean {
  return set.n === row.n && (set.side ?? undefined) === (row.side ?? undefined)
}

export function findSet(entry: Entry | undefined, row: SetRow): SetLog | undefined {
  return entry?.sets.find((set) => sameRow(set, row))
}

/** A set counts as confirmed once it carries at least one real value. */
export function isSetConfirmed(set: SetLog | undefined): boolean {
  if (!set) return false
  return (
    set.weight !== undefined ||
    set.reps !== undefined ||
    set.seconds !== undefined ||
    set.distanceM !== undefined ||
    set.minutes !== undefined
  )
}

/**
 * Last week's set for this exact row (same number and side) when it holds a
 * value: what D-053 saves an untouched row from, and the only value the
 * last-week cell shows (D-054 rule 5).
 */
export function exactReferenceSet(entry: Entry | undefined, row: SetRow): SetLog | undefined {
  return entry?.sets.find((set) => sameRow(set, row) && isSetConfirmed(set))
}

/** Text the parser could not read, kept verbatim so nothing is lost. */
export function isSetFlagged(set: SetLog | undefined): boolean {
  return set !== undefined && !isSetConfirmed(set) && (set.raw ?? '') !== ''
}

export function findEntry(
  session: Session | undefined,
  itemId: string,
): Entry | undefined {
  return session?.entries.find((entry) => entry.itemId === itemId)
}

export type DayState = 'done' | 'partial' | 'not-started'

/** endedAt means done; any recorded entry without it means partial. */
export function sessionState(session: Session | undefined): DayState {
  if (!session) return 'not-started'
  if (session.endedAt) return 'done'
  const touched = session.entries.some(
    (entry) =>
      entry.checked === true ||
      entry.sets.length > 0 ||
      (entry.note ?? '') !== '',
  )
  return touched ? 'partial' : 'not-started'
}

// ── Last-week reference (task 8) ──

/** The type a set was logged as, read from its values (a set stores no type). */
export function setType(set: SetLog): ItemType {
  if (set.weight !== undefined) return 'load_reps'
  if (set.seconds !== undefined) return 'timed_hold'
  if (set.distanceM !== undefined) return 'distance'
  if (set.minutes !== undefined) return 'cardio_block'
  return 'bodyweight_reps'
}

/**
 * D-074 rule 5: an entry is a reference only when it is comparable. For a
 * load-and-reps item, at least one confirmed set carries a weight; for other
 * types, the entry was logged as the same type.
 */
export function isComparableEntry(entry: Entry, type: ItemType | undefined): boolean {
  const confirmed = entry.sets.filter(isSetConfirmed)
  if ((type ?? 'load_reps') === 'load_reps') return confirmed.some((set) => set.weight !== undefined)
  if (confirmed.length === 0) return false
  return (entry.fields?.type ?? setType(confirmed[0])) === type
}

/**
 * The set to show and pre-fill from: the most recent finished session for the
 * same day that logged this exercise comparably (D-074 rule 5), falling back
 * to the most recent finished session that logged it on any day.
 */
export function findReferenceEntry(
  sessions: Session[],
  dayId: string,
  exerciseId: string,
  type: ItemType | undefined = 'load_reps',
): Entry | undefined {
  const finished = sessions
    .filter((session) => session.endedAt)
    .sort((a, b) => b.date.localeCompare(a.date))

  const has = (session: Session) =>
    session.entries.find(
      (entry) => entry.exerciseId === exerciseId && entry.sets.length > 0 && isComparableEntry(entry, type),
    )

  for (const session of finished) {
    if (session.dayId !== dayId) continue
    const entry = has(session)
    if (entry) return entry
  }
  for (const session of finished) {
    const entry = has(session)
    if (entry) return entry
  }
  return undefined
}

/**
 * Set N of the reference entry is the reference for row N. A per-side row
 * prefers the same side, then falls back to the same set number on either side,
 * so an exercise that was logged without sides still gives a useful number.
 */
export function referenceSet(
  entry: Entry | undefined,
  row: SetRow,
): SetLog | undefined {
  if (!entry) return undefined
  const exact = entry.sets.find((set) => sameRow(set, row))
  if (exact && isSetConfirmed(exact)) return exact
  const sameNumber = entry.sets.filter(
    (set) => set.n === row.n && isSetConfirmed(set),
  )
  return sameNumber[0]
}

// ── Summary (task 11) ──

export interface SessionSummary {
  setsConfirmed: number
  durationMin: number | null
  skipped: number
  swapped: boolean
}

export function summarise(
  session: Session | undefined,
  deck: DeckItem[],
): SessionSummary {
  let setsConfirmed = 0
  let skipped = 0

  for (const deckItem of deck) {
    const entry = findEntry(session, deckItem.item.id)
    if (deckItem.logged) {
      const confirmed = (entry?.sets ?? []).filter(isSetConfirmed)
      setsConfirmed += confirmed.length
      // D-048: Discomfort marks the entry skipped even with some sets done.
      if (confirmed.length === 0 || entry?.skipped) skipped += 1
    } else if (entry?.checked !== true) {
      skipped += 1
    }
  }

  const durationMin =
    session?.startedAt && session.endedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(session.endedAt).getTime() -
              new Date(session.startedAt).getTime()) /
              60000,
          ),
        )
      : null

  return {
    setsConfirmed,
    durationMin,
    skipped,
    swapped: session?.swapped === true,
  }
}

function orderKey(row: { n: number; side?: string }): number {
  return row.n * 2 + (row.side === 'R' ? 1 : 0)
}

/**
 * The load a bare rep count inherits: the nearest confirmed set above this row
 * in the current session (EXEC-04 2a). Undefined when nothing above carries one.
 */
export function nearestWeightAbove(
  entry: Entry | undefined,
  row: SetRow,
): number | undefined {
  if (!entry) return undefined
  const target = orderKey(row)
  const above = entry.sets
    .filter(
      (set) =>
        isSetConfirmed(set) && set.weight !== undefined && orderKey(set) < target,
    )
    .sort((a, b) => orderKey(a) - orderKey(b))
  return above.length > 0 ? above[above.length - 1].weight : undefined
}

/**
 * Rest days have no Finish button, so a rest day whose check-off items are all
 * checked counts as done (EXEC-04 2b).
 */
export function restDayState(
  session: Session | undefined,
  deck: DeckItem[],
): DayState {
  if (!session) return 'not-started'
  if (session.endedAt) return 'done'
  const checkable = deck.filter((deckItem) => !deckItem.logged)
  if (
    checkable.length > 0 &&
    checkable.every(
      (deckItem) => findEntry(session, deckItem.item.id)?.checked === true,
    )
  ) {
    return 'done'
  }
  return sessionState(session)
}
