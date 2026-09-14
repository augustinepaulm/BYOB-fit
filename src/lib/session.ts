// Session shape and rules (EXEC-03 tasks 6, 8, 11). Pure functions only.

import type { Day, Item, ItemFields, Section } from '../types/program.ts'
import type { Entry, Session, SetLog } from '../types/stores.ts'
import { isLogged, resolveItem } from './program.ts'

export interface DeckItem {
  /** 1-based position across the whole session, for "item N of M". */
  position: number
  section: Section
  item: Item
  resolved: ItemFields & { id: string }
  logged: boolean
}

/** Every item of a day, in section order, resolved for the program week. */
export function buildDeck(day: Day, week: number): DeckItem[] {
  const deck: DeckItem[] = []
  for (const section of day.sections) {
    for (const item of section.items) {
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

/**
 * The set to show and pre-fill from: the most recent finished session for the
 * same day that logged this exercise, falling back to the most recent finished
 * session that logged it on any day.
 */
export function findReferenceEntry(
  sessions: Session[],
  dayId: string,
  exerciseId: string,
): Entry | undefined {
  const finished = sessions
    .filter((session) => session.endedAt)
    .sort((a, b) => b.date.localeCompare(a.date))

  const has = (session: Session) =>
    session.entries.find(
      (entry) => entry.exerciseId === exerciseId && entry.sets.length > 0,
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
  /** One line per unit actually used, no conversion (D-012). */
  volumeByUnit: { unit: string; volume: number }[]
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
  const volumes = new Map<string, number>()

  for (const deckItem of deck) {
    const entry = findEntry(session, deckItem.item.id)
    if (deckItem.logged) {
      const confirmed = (entry?.sets ?? []).filter(isSetConfirmed)
      setsConfirmed += confirmed.length
      if (confirmed.length === 0) skipped += 1
      if (deckItem.resolved.type === 'load_reps') {
        // D-012: shown as entered, kg unless the item says otherwise.
        const unit = deckItem.resolved.unit ?? 'kg'
        for (const set of confirmed) {
          if (set.weight !== undefined && set.reps !== undefined) {
            volumes.set(unit, (volumes.get(unit) ?? 0) + set.weight * set.reps)
          }
        }
      }
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
    volumeByUnit: [...volumes.entries()]
      .filter(([, volume]) => volume > 0)
      .map(([unit, volume]) => ({ unit, volume }))
      .sort((a, b) => a.unit.localeCompare(b.unit)),
    durationMin,
    skipped,
    swapped: session?.swapped === true,
  }
}
