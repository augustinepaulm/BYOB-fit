// Add and change exercises during a session, and edit from Log (D-069 rules 7
// to 10, EXEC-12 commit C). Pure functions: no storage, no DOM.

import type { Day, Item, ItemFields, Program, Section } from '../types/program.ts'
import type { Entry, Session, SetLog } from '../types/stores.ts'
import { finishDraft, loadDraft, newId, usedIds } from './builder.ts'
import { dayLabel } from './dayChanges.ts'
import { prescriptionText } from './prescription.ts'
import { isActiveOn, isLogged, resolveItem } from './program.ts'
import { isSetConfirmed, type DeckItem } from './session.ts'
import { readAmount, readLoadSet, type BoxResult } from './setBoxes.ts'
import type { OrderEntry } from './todayPlan.ts'

// ── Add exercise (rule 7) ──

export interface AddableItem {
  item: Item
  day: Day
  section: Section
  resolved: ItemFields & { id: string }
  name: string
  /** "<exercise> · <day> · <prescription>" */
  label: string
}

/** Every active item of the program across all days, in day and section order; an exercise on two days appears twice. */
export function addableItems(program: Program, week: number, date: Date): AddableItem[] {
  const out: AddableItem[] = []
  for (const day of [...program.days].sort((a, b) => a.order - b.order)) {
    for (const section of day.sections) {
      for (const item of section.items) {
        if (!isActiveOn(item, date)) continue
        const resolved = resolveItem(item, week)
        const name = program.exercises[resolved.exerciseId ?? item.exerciseId]?.name ?? item.exerciseId
        const prescription = prescriptionText(resolved)
        out.push({ item, day, section, resolved, name, label: [name, dayLabel(day), prescription].filter(Boolean).join(' · ') })
      }
    }
  }
  return out
}

/** Search by exercise name, case-insensitive. */
export function searchAddable(items: AddableItem[], query: string): AddableItem[] {
  const q = query.trim().toLowerCase()
  return q === '' ? items : items.filter((i) => i.name.toLowerCase().includes(q))
}

/** A new item id for today's added entry: never a program item id, never one already in the session. */
export function newAddedItemId(program: Program, session: Session | null | undefined): string {
  const taken = new Set([...usedIds(program), ...(session?.entries ?? []).map((e) => e.itemId)])
  let n = 1
  while (taken.has(`added-${n}`)) n += 1
  return `added-${n}`
}

/** The prescription a session entry carries: an item's fields without its identity. */
function fieldsOf(resolved: ItemFields & { id?: string }): ItemFields {
  const fields: ItemFields & { id?: string } = { ...resolved }
  delete fields.id
  return fields
}

/** The entry for an exercise added today (rule 7): a new item id, where it came from, and its prescription. */
export function addedEntry(source: AddableItem, itemId: string): Entry {
  return {
    itemId,
    exerciseId: source.resolved.exerciseId ?? source.item.exerciseId,
    sets: [],
    added: { fromItemId: source.item.id },
    fields: fieldsOf(source.resolved),
  }
}

/** Today's order with `newId` right after the current item, in the current item's section. */
export function insertAfter(order: OrderEntry[], currentId: string, newItemId: string, sectionId: string): OrderEntry[] {
  const at = order.findIndex((o) => o.itemId === currentId)
  const next = order.filter((o) => o.itemId !== newItemId)
  const index = at < 0 ? next.length : next.findIndex((o) => o.itemId === currentId) + 1
  return [...next.slice(0, index), { itemId: newItemId, sectionId }, ...next.slice(index)]
}

function findItem(program: Program, itemId: string): { item: Item; section: Section; day: Day } | null {
  for (const day of program.days) for (const section of day.sections) {
    const item = section.items.find((i) => i.id === itemId)
    if (item) return { item, section, day }
  }
  return null
}

/**
 * Deck items for today's added entries. Each logs like its source item did in
 * the program; with the source gone, everything but a check item logs.
 */
export function addedDeckItems(session: Session | null | undefined, program: Program, day: Day): DeckItem[] {
  const out: DeckItem[] = []
  for (const entry of session?.entries ?? []) {
    if (!entry.added || !entry.fields) continue
    const source = findItem(program, entry.added.fromItemId)
    const section = source?.section ?? day.sections[0]
    if (!section) continue
    const item: Item = { ...entry.fields, id: entry.itemId, exerciseId: entry.exerciseId, type: entry.fields.type ?? 'load_reps' }
    const logged = source ? isLogged(source.section.kind, { ...source.item, ...entry.fields }) : item.type !== 'check'
    out.push({ position: 0, section, item, resolved: { ...entry.fields, id: entry.itemId, exerciseId: entry.exerciseId }, logged })
  }
  return out
}

/**
 * A deck item as today logs it: an entry with its own prescription (added or
 * changed, rule 9) replaces the program's, and a changed entry logs by its
 * type, so a check warm-up swapped for a timed hold gets set rows.
 */
export function effectiveDeckItem(deckItem: DeckItem, entry: Entry | undefined): DeckItem {
  if (!entry?.fields || !(entry.changed || entry.added)) return deckItem
  const resolved = { ...entry.fields, id: deckItem.item.id, exerciseId: entry.exerciseId }
  const logged = entry.changed ? (entry.fields.logged ?? entry.fields.type !== 'check') : deckItem.logged
  return { ...deckItem, resolved, logged }
}

// ── Swap with its own prescription (rule 8) ──

/**
 * The step's starting values: that exercise's first active item elsewhere in
 * the program, otherwise the item being swapped. The exercise is the picked one.
 */
export function swapPrefill(program: Program, exerciseId: string, swappedItemId: string, week: number, date: Date, swapped: ItemFields): { fields: ItemFields; from: 'elsewhere' | 'swapped' } {
  for (const day of [...program.days].sort((a, b) => a.order - b.order)) {
    for (const section of day.sections) {
      for (const item of section.items) {
        if (item.id === swappedItemId || !isActiveOn(item, date)) continue
        const resolved = resolveItem(item, week)
        if ((resolved.exerciseId ?? item.exerciseId) === exerciseId) return { fields: { ...fieldsOf(resolved), exerciseId }, from: 'elsewhere' }
      }
    }
  }
  return { fields: { ...fieldsOf(swapped as ItemFields & { id?: string }), exerciseId }, from: 'swapped' }
}

// ── Progression (rule 9) ──

/** The program item's recent entries with this exercise, newest first, before `beforeDate`; changed entries do not count. */
export function progressionHistory(sessions: Session[], itemId: string, exerciseId: string, beforeDate: string): Entry[] {
  return [...sessions]
    .filter((s) => s.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((s) => s.entries.filter((e) => e.itemId === itemId && e.exerciseId === exerciseId && !e.changed))
}

// ── Keep an added exercise in the program (rule 7) ──

/**
 * A copy of the source item, under a new id, in today's day right after the
 * program item it followed today; with none before it, first in its section.
 */
export function keepAddedInProgram(program: Program, dayId: string, order: OrderEntry[], entry: Entry): Program {
  const draft = loadDraft(program)
  const day = draft.days.find((d) => d.id === dayId)
  const source = entry.added ? findItem(draft, entry.added.fromItemId) : null
  if (!day || !source) return finishDraft(draft, program)
  const copy: Item = { ...structuredClone(source.item), id: newId(draft, 'item') }
  delete copy.retiredFrom
  const at = order.findIndex((o) => o.itemId === entry.itemId)
  const dayItemIds = new Set(day.sections.flatMap((s) => s.items.map((i) => i.id)))
  const before = order.slice(0, Math.max(0, at)).reverse().find((o) => dayItemIds.has(o.itemId))
  const ownSection = order[at]?.sectionId
  day.sections = day.sections.map((section) => {
    if (before) {
      const i = section.items.findIndex((item) => item.id === before.itemId)
      if (i < 0) return section
      return { ...section, items: [...section.items.slice(0, i + 1), copy, ...section.items.slice(i + 1)] }
    }
    return section.id === (ownSection ?? day.sections[0]?.id) ? { ...section, items: [copy, ...section.items] } : section
  })
  return finishDraft(draft, program)
}

// ── Edit from Log (rule 10) ──

export type SetEdit = { ok: true; set: SetLog } | { ok: false; errors: { weight?: string; reps?: string; value?: string } }

/**
 * A logged set edited in Log: typed and confirmed through the deck's boxes
 * (D-051, D-053), with the time of the edit. Invalid input changes nothing.
 */
export function editLoggedSet(set: SetLog, type: Item['type'] | undefined, input: { weight?: string; reps?: string; value?: string }, now: Date): SetEdit {
  const base: SetLog = { n: set.n, ...(set.side ? { side: set.side } : {}) }
  if (!type || type === 'load_reps') {
    const result = readLoadSet(input.weight ?? '', input.reps ?? '', {})
    if (!result.ok) return { ok: false, errors: { ...(result.weight.ok ? {} : { weight: result.weight.error }), ...(result.reps.ok ? {} : { reps: result.reps.error }) } }
    return { ok: true, set: { ...base, weight: result.weight, reps: result.reps, editedAt: now.toISOString() } }
  }
  const one: Record<string, { kind: 'reps' | 'seconds' | 'meters' | 'minutes'; field: 'reps' | 'seconds' | 'distanceM' | 'minutes' }> = {
    bodyweight_reps: { kind: 'reps', field: 'reps' },
    timed_hold: { kind: 'seconds', field: 'seconds' },
    distance: { kind: 'meters', field: 'distanceM' },
    cardio_block: { kind: 'minutes', field: 'minutes' },
  }
  const spec = one[type]
  if (!spec) return { ok: false, errors: { value: 'This set cannot be edited' } }
  const value: BoxResult = readAmount(input.value ?? '', spec.kind)
  if (!value.ok) return { ok: false, errors: { value: value.error } }
  return { ok: true, set: { ...base, [spec.field]: value.value, editedAt: now.toISOString() } }
}

/** The session with one set replaced, matched by entry, set number and side. */
export function replaceSet(session: Session, itemId: string, edited: SetLog): Session {
  return {
    ...session,
    entries: session.entries.map((entry) =>
      entry.itemId !== itemId
        ? entry
        : { ...entry, sets: entry.sets.map((s) => (s.n === edited.n && (s.side ?? '') === (edited.side ?? '') ? edited : s)) },
    ),
  }
}

/** Sets a session holds for an exercise, as Log lists them for editing. */
export function loggedSetsOf(session: Session, exerciseId: string): { entry: Entry; set: SetLog }[] {
  return session.entries.filter((e) => e.exerciseId === exerciseId).flatMap((entry) => entry.sets.filter(isSetConfirmed).map((set) => ({ entry, set })))
}
