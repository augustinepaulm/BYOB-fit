// Mid-week AI update (D-027, D-043 rules 1 and 3). The model returns a whole
// D-025 patch for week N. A change to an item on a day not yet started is a
// byWeek override keyed N; on a day already started, keyed N+1. Removes and
// exercise swaps of items with history retire them from the first date the
// change applies; adds go into the base program.

import type { Item, ItemFields, Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { findItem, newId } from './builder.ts'
import { toISODate } from './dates.ts'
import { parseISODate, resolveItem } from './program.ts'
import { addAdditions, type Proposal } from './reprogram.ts'

/** ISO date of a day in a program week. */
export function dayDate(program: Program, dayId: string, week: number): string {
  const day = program.days.find((d) => d.id === dayId)
  const start = parseISODate(program.startDate)
  const offset = (week - 1) * 7 + (day?.order ?? 0)
  return toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset))
}

/**
 * Days already started this week: their date is before today, or a session
 * this week has begun them.
 */
export function startedDays(program: Program, week: number, sessions: Session[], today: string): Set<string> {
  const started = new Set<string>()
  for (const day of program.days) {
    if (dayDate(program, day.id, week) < today) started.add(day.id)
  }
  for (const session of sessions) {
    if (session.programWeek === week && (session.startedAt || session.entries.length > 0)) started.add(session.dayId)
  }
  return started
}

export interface UpdateContext {
  week: number
  started: Set<string>
  history: Set<string>
}

export interface UpdateResult {
  program: Program
  /** The byWeek key each changed item was written under. */
  keys: Record<string, number>
  /** Changes that would land after the program's last week, left out. */
  skipped: string[]
}

/** The week a change to an item on `dayId` takes effect. */
export function weekFor(dayId: string, ctx: UpdateContext): number {
  return ctx.started.has(dayId) ? ctx.week + 1 : ctx.week
}

const PRESCRIPTION: (keyof ItemFields)[] = [
  'type', 'perSide', 'sets', 'repMin', 'repMax', 'holdSec', 'distanceM',
  'minutes', 'tempo', 'restSec', 'rpe', 'unit', 'logged',
]

function mapItem(program: Program, itemId: string, fn: (item: Item) => Item | Item[] | null): Program {
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      sections: day.sections.map((s) => ({
        ...s,
        items: s.items.flatMap((i) => {
          if (i.id !== itemId) return [i]
          const out = fn(i)
          return out === null ? [] : Array.isArray(out) ? out : [out]
        }),
      })),
    })),
  }
}

export function applyUpdate(program: Program, proposal: Proposal, ctx: UpdateContext): UpdateResult {
  let next: Program = structuredClone(program)
  const keys: Record<string, number> = {}
  const skipped: string[] = []

  for (const override of proposal.overrides) {
    const found = findItem(next, override.itemId)
    if (!found) continue
    const key = weekFor(found.day.id, ctx)
    if (key > next.programWeeks) {
      skipped.push(override.itemId)
      continue
    }
    // The item as it would stand in the week the change applies.
    const current = resolveItem(found.item, key)
    const swapping =
      override.fields.exerciseId !== undefined &&
      override.fields.exerciseId !== current.exerciseId &&
      ctx.history.has(override.itemId)
    if (swapping) {
      // D-042 rule 4: the old item retires on the day the change applies; a
      // new base item carries the new exercise with the same prescription.
      const retiredFrom = dayDate(next, found.day.id, key)
      const id = newId(next, 'item')
      const replacement: Item = { id, exerciseId: override.fields.exerciseId!, type: current.type ?? found.item.type }
      for (const field of PRESCRIPTION) {
        const value = (current as unknown as Record<string, unknown>)[field]
        if (value !== undefined) (replacement as unknown as Record<string, unknown>)[field] = value
      }
      Object.assign(replacement, override.fields)
      next = mapItem(next, override.itemId, (item) => [{ ...item, retiredFrom }, replacement])
      keys[id] = key
      continue
    }
    const week = String(key)
    next = mapItem(next, override.itemId, (item) => ({
      ...item,
      byWeek: { ...item.byWeek, [week]: { ...item.byWeek?.[week], ...override.fields } },
    }))
    keys[override.itemId] = key
  }

  addAdditions(next, proposal.add)

  for (const removal of proposal.remove) {
    const found = findItem(next, removal.itemId)
    if (!found) continue
    const key = weekFor(found.day.id, ctx)
    if (!ctx.history.has(removal.itemId)) {
      next = mapItem(next, removal.itemId, () => null)
      continue
    }
    if (key > next.programWeeks) {
      skipped.push(removal.itemId)
      continue
    }
    const retiredFrom = dayDate(next, found.day.id, key)
    next = mapItem(next, removal.itemId, (item) => ({ ...item, retiredFrom }))
    keys[removal.itemId] = key
  }

  return { program: next, keys, skipped }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Frame 4f's line: "Applies from Thursday." then, for each started day with
 * changes, "<Day> picks them up on <weekday>."
 */
export function appliesFromText(program: Program, proposal: Proposal, ctx: UpdateContext): string {
  const days = [...program.days].sort((a, b) => a.order - b.order)
  const firstOpen = days.find((d) => !ctx.started.has(d.id))
  const head = firstOpen ? `Applies from ${WEEKDAYS[firstOpen.order]}.` : 'Applies from next week.'
  const touched = new Set<string>()
  for (const id of [...proposal.overrides.map((o) => o.itemId), ...proposal.remove.map((r) => r.itemId)]) {
    const day = findItem(program, id)?.day
    if (day) touched.add(day.id)
  }
  const later = days
    .filter((d) => touched.has(d.id) && ctx.started.has(d.id))
    .map((d) => `${d.name} picks them up on ${WEEKDAYS[d.order]}.`)
  return [head, ...later].join(' ')
}
