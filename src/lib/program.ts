// Pure program logic. The rules here are the ones frozen in PLAN v1.3 section 5;
// nothing in this file touches storage, the DOM, or the clock.

import type {
  Day,
  Item,
  ItemFields,
  Program,
  SectionKind,
} from '../types/program.ts'
import type { WeekPlan } from '../types/stores.ts'

const MS_PER_DAY = 86_400_000

/** Calendar-day index for a local date, immune to DST shifts. */
function dayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY,
  )
}

/** Parse a YYYY-MM-DD schema date as a local calendar date, not UTC midnight. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * currentWeek = floor((today - startDate) / 7 days) + 1, clamped to
 * 1..programWeeks. startDate is the Sunday that begins program week 1.
 */
export function currentWeek(program: Program, today: Date): number {
  const days = dayIndex(today) - dayIndex(parseISODate(program.startDate))
  const week = Math.floor(days / 7) + 1
  if (week < 1) return 1
  if (week > program.programWeeks) return program.programWeeks
  return week
}

/**
 * Apply byWeek overrides for a program week (D-023). Overrides are cumulative:
 * every override whose key is <= week applies in ascending key order on top of
 * the base item, later keys overwriting earlier ones field by field. A field a
 * later key does not mention keeps the value an earlier key gave it.
 */
export function resolveItem(item: Item, week: number): ItemFields & { id: string } {
  const { byWeek, ...base } = item
  if (!byWeek) return base
  const keys = Object.keys(byWeek)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n <= week)
    .sort((a, b) => a - b)
  return keys.reduce<ItemFields & { id: string }>(
    (resolved, key) => ({ ...resolved, ...byWeek[String(key)] }),
    base,
  )
}

/**
 * Whether an item records entries. main, block and abs log per set; cardio logs
 * minutes; warmup, cooldown and daily are check-off. `logged` on the item wins.
 */
export function isLogged(sectionKind: SectionKind, item: ItemFields): boolean {
  if (item.logged !== undefined) return item.logged
  return (
    sectionKind === 'main' ||
    sectionKind === 'block' ||
    sectionKind === 'abs' ||
    sectionKind === 'cardio'
  )
}

/**
 * The day to train on a date: the template day whose order matches the weekday
 * (0 = Sunday), redirected to its partner when the week plan records a swap.
 */
export function dayForDate(
  program: Program,
  weekPlan: WeekPlan | null | undefined,
  date: Date,
): Day {
  const scheduled = program.days.find((d) => d.order === date.getDay())
  if (!scheduled) {
    throw new Error(`Program has no day with order ${date.getDay()}`)
  }
  for (const [a, b] of weekPlan?.swaps ?? []) {
    if (a === scheduled.id) return dayById(program, b)
    if (b === scheduled.id) return dayById(program, a)
  }
  return scheduled
}

function dayById(program: Program, id: string): Day {
  const day = program.days.find((d) => d.id === id)
  if (!day) throw new Error(`Program has no day with id ${id}`)
  return day
}

/** The seven dates of a program week, Sunday first. */
export function weekDates(program: Program, week: number): Date[] {
  const start = parseISODate(program.startDate)
  const offset = (week - 1) * 7
  return Array.from(
    { length: 7 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + i),
  )
}
