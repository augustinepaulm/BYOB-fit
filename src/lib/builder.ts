// Program builder rules (D-028, D-042, EXEC-08 task 3). Pure functions: no
// storage, no DOM, no clock. Dates come in as ISO strings (YYYY-MM-DD).

import type {
  Day,
  Equipment,
  Exercise,
  ExerciseLevel,
  Item,
  ItemFields,
  ItemType,
  Muscle,
  Program,
  SectionKind,
} from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { importProgram } from './importProgram.ts'

// ── Ids (D-042 rule 2) ──

/** Every id the program uses: days, sections, items, exercises, and exercise ids inside byWeek. */
export function usedIds(program: Program): Set<string> {
  const ids = new Set<string>(Object.keys(program.exercises))
  for (const day of program.days) {
    ids.add(day.id)
    for (const section of day.sections) {
      ids.add(section.id)
      for (const item of section.items) {
        ids.add(item.id)
        ids.add(item.exerciseId)
        if (item.alternateExerciseId) ids.add(item.alternateExerciseId)
        for (const override of Object.values(item.byWeek ?? {})) {
          if (override.exerciseId) ids.add(override.exerciseId)
          if (override.alternateExerciseId) ids.add(override.alternateExerciseId)
        }
      }
    }
  }
  return ids
}

/**
 * `<prefix>-<n>` with n above every number already used with that prefix, so an
 * id freed earlier in the same program is not handed out again.
 */
export function newId(program: Program, prefix: string): string {
  const ids = usedIds(program)
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`)
  let n = 0
  for (const id of ids) {
    const match = pattern.exec(id)
    if (match) n = Math.max(n, Number(match[1]))
  }
  let candidate = `${prefix}-${n + 1}`
  while (ids.has(candidate)) candidate = `${prefix}-${++n + 1}`
  return candidate
}

// ── History (D-042 rule 3) ──

/** Item ids that appear in any stored session entry. */
export function itemsWithHistory(sessions: Session[]): Set<string> {
  const ids = new Set<string>()
  for (const session of sessions) for (const entry of session.entries) ids.add(entry.itemId)
  return ids
}

/** Item ids a session dated `today` has already logged (a set or a check). */
export function itemsLoggedOn(sessions: Session[], today: string): Set<string> {
  const ids = new Set<string>()
  for (const session of sessions) {
    if (session.date !== today) continue
    for (const entry of session.entries) {
      if (entry.sets.length > 0 || entry.checked) ids.add(entry.itemId)
    }
  }
  return ids
}

/** Distinct program weeks in which an item was logged, for the 2i sheet. */
export function weeksOfHistory(sessions: Session[], itemId: string): number {
  const weeks = new Set<number>()
  for (const session of sessions) {
    if (session.entries.some((e) => e.itemId === itemId)) weeks.add(session.programWeek)
  }
  return weeks.size
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** today, or tomorrow when a session today already logged the item. */
function retireDate(itemId: string, today: string, loggedToday: Set<string>): string {
  return loggedToday.has(itemId) ? addDays(today, 1) : today
}

function mapItems(program: Program, fn: (item: Item) => Item | Item[] | null): Program {
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      sections: day.sections.map((section) => ({
        ...section,
        items: section.items.flatMap((item) => {
          const result = fn(item)
          return result === null ? [] : Array.isArray(result) ? result : [result]
        }),
      })),
    })),
  }
}

/** Add an exercise to a program's list if it is not there yet. */
export function withExercise(program: Program, entry: LibraryEntry): Program {
  if (program.exercises[entry.id]) return program
  return { ...program, exercises: { ...program.exercises, [entry.id]: entry.exercise } }
}

export function findItem(program: Program, itemId: string): { day: Day; item: Item } | null {
  for (const day of program.days) {
    for (const section of day.sections) {
      const item = section.items.find((i) => i.id === itemId)
      if (item) return { day, item }
    }
  }
  return null
}

/**
 * D-042 rule 3: an item without history is deleted; one with history is
 * retired from today, or from tomorrow if today's session already logged it.
 */
export function removeItem(
  draft: Program,
  itemId: string,
  history: Set<string>,
  today: string,
  loggedToday: Set<string>,
): Program {
  if (!history.has(itemId)) return mapItems(draft, (item) => (item.id === itemId ? null : item))
  const retiredFrom = retireDate(itemId, today, loggedToday)
  return mapItems(draft, (item) => (item.id === itemId ? { ...item, retiredFrom } : item))
}

/** The prescription a swapped-in item keeps: how it is done, not what is done. */
const PRESCRIPTION: (keyof ItemFields)[] = [
  'type', 'perSide', 'sets', 'repMin', 'repMax', 'holdSec', 'distanceM',
  'minutes', 'tempo', 'restSec', 'rpe', 'unit', 'logged',
]

/**
 * D-042 rule 4: without history the item's exercise changes in place. With
 * history the item is retired and a new item with the new exercise and the
 * same prescription goes directly after it, so old numbers stay with the old
 * exercise.
 */
export function swapExercise(
  draft: Program,
  itemId: string,
  exerciseId: string,
  history: Set<string>,
  today: string,
  loggedToday: Set<string>,
): Program {
  if (!history.has(itemId)) {
    return mapItems(draft, (item) => (item.id === itemId ? { ...item, exerciseId } : item))
  }
  const id = newId(draft, 'item')
  const retiredFrom = retireDate(itemId, today, loggedToday)
  return mapItems(draft, (item) => {
    if (item.id !== itemId) return item
    const next: Item = { id, exerciseId, type: item.type }
    for (const key of PRESCRIPTION) {
      if (item[key] !== undefined) (next as unknown as Record<string, unknown>)[key] = item[key]
    }
    return [{ ...item, retiredFrom }, next]
  })
}

// ── Session length (D-042 rule 8, docs/STARTER-PROGRAMS.md) ──

/**
 * sets × (work × sides + rest) + 1 per item, work 40 s unless holdSec, rest
 * 1 min unless restSec; cardio blocks add their minutes. Retired items are
 * left out. Rounded to the nearest 5.
 */
export function sessionMinutes(day: Day): number {
  let total = 0
  for (const section of day.sections) {
    for (const item of section.items) {
      if (item.retiredFrom) continue
      if (item.type === 'cardio_block') {
        total += item.minutes ?? 0
        continue
      }
      const work = item.holdSec !== undefined ? item.holdSec / 60 : 40 / 60
      const sides = item.perSide ? 2 : 1
      const rest = item.restSec !== undefined ? item.restSec / 60 : 1
      total += (item.sets ?? 1) * (work * sides + rest) + 1
    }
  }
  return Math.round(total / 5) * 5
}

// ── Exercise library (D-042 rule 7) ──

export interface LibraryEntry {
  id: string
  exercise: Exercise
}

/** Starter-program exercises first, then every stored program's; first id wins. */
export function exerciseLibrary(templates: Program[], programs: Program[]): LibraryEntry[] {
  const seen = new Map<string, Exercise>()
  for (const program of [...templates, ...programs]) {
    for (const [id, exercise] of Object.entries(program.exercises)) {
      if (!seen.has(id)) seen.set(id, exercise)
    }
  }
  return [...seen].map(([id, exercise]) => ({ id, exercise }))
}

export interface LibraryFilter {
  sameMusclesAs?: Muscle[]
  beginner?: boolean
  noEquipment?: boolean
  query?: string
}

/**
 * Metadata filters need the metadata: an exercise without muscles, level or
 * equipment only shows when none of those filters is on. The text query needs
 * only the name.
 */
export function filterLibrary(lib: LibraryEntry[], filter: LibraryFilter): LibraryEntry[] {
  const muscles = filter.sameMusclesAs?.length ? filter.sameMusclesAs : null
  const words = (filter.query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  return lib.filter(({ exercise }) => {
    if (muscles && !exercise.muscles?.some((m) => muscles.includes(m))) return false
    if (filter.beginner && exercise.level !== 'beginner') return false
    if (filter.noEquipment && exercise.equipment !== 'none') return false
    if (words.length && !words.every((w) => searchText(exercise).includes(w))) return false
    return true
  })
}

/** Name, muscles and equipment, as the search reads them (EXEC-11 task 11). */
function searchText(exercise: Exercise): string {
  const parts = [exercise.name, ...(exercise.muscles ?? []).flatMap((m) => [m, muscleLabel(m)])]
  if (exercise.equipment) parts.push(exercise.equipment, EQUIPMENT_LABEL[exercise.equipment])
  return parts.join(' ').toLowerCase()
}

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  none: 'no equipment',
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  cable: 'cable',
  machine: 'machine',
  band: 'band',
  bench: 'bench',
  cardio_machine: 'cardio machine',
  other: 'other equipment',
}

export const MUSCLES: Muscle[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core', 'full_body', 'cardio']
export const EQUIPMENT: Equipment[] = Object.keys(EQUIPMENT_LABEL) as Equipment[]
export const LEVELS: ExerciseLevel[] = ['beginner', 'intermediate', 'experienced']

export function muscleLabel(muscle: Muscle): string {
  return muscle === 'full_body' ? 'full body' : muscle
}

export function equipmentLabel(equipment: Equipment): string {
  return EQUIPMENT_LABEL[equipment]
}

/** "Legs · machine · beginner" (frames 2c, 2d); empty when nothing is known. */
export function exerciseMeta(exercise: Exercise): string {
  const parts = [
    exercise.muscles?.length ? exercise.muscles.map(muscleLabel).join(', ') : null,
    exercise.equipment ? equipmentLabel(exercise.equipment) : null,
    exercise.level ?? null,
  ].filter((p): p is string => p !== null)
  const text = parts.join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "Leg press" to "leg press" for running text ("Use leg press"). */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** The how-to as numbered steps (2d): one per sentence. */
export function howToSteps(howTo: string): string[] {
  return howTo
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ── Item fields and their errors (2h) ──

export const SECTION_ORDER: SectionKind[] = ['warmup', 'main', 'block', 'abs', 'cardio', 'cooldown', 'daily']

export const SECTION_TITLE: Record<SectionKind, string> = {
  warmup: 'Warm-up',
  main: 'Main',
  block: 'Block',
  abs: 'Abs',
  cardio: 'Cardio',
  cooldown: 'Cooldown',
  daily: 'Daily',
}

export const TYPE_LABEL: Record<ItemType, string> = {
  load_reps: 'Weight and reps',
  bodyweight_reps: 'Bodyweight reps',
  timed_hold: 'Timed hold',
  distance: 'Distance',
  cardio_block: 'Cardio minutes',
  check: 'Check-off',
}

/** The fields each type uses in the item editor. */
export const TYPE_FIELDS: Record<ItemType, (keyof ItemFields)[]> = {
  load_reps: ['sets', 'repMin', 'repMax', 'restSec', 'tempo', 'perSide'],
  bodyweight_reps: ['sets', 'repMin', 'repMax', 'restSec', 'tempo', 'perSide'],
  timed_hold: ['sets', 'holdSec', 'restSec', 'perSide'],
  distance: ['sets', 'distanceM', 'restSec'],
  cardio_block: ['minutes'],
  check: [],
}

/** Numeric fields a type needs to be usable. */
const REQUIRED: Partial<Record<ItemType, (keyof ItemFields)[]>> = {
  timed_hold: ['holdSec'],
  distance: ['distanceM'],
  cardio_block: ['minutes'],
}

export type FieldErrors = Partial<Record<keyof ItemFields, string>>

/** Inline errors keyed by the field that caused them (2h). */
export function itemErrors(item: ItemFields): FieldErrors {
  const errors: FieldErrors = {}
  const whole = (key: keyof ItemFields, min: number) => {
    const value = item[key]
    if (value === undefined) return
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
      errors[key] = min === 0 ? 'Use a whole number, 0 or more' : `Use a whole number, ${min} or more`
    }
  }
  for (const key of ['sets', 'repMin', 'repMax', 'holdSec', 'distanceM', 'minutes'] as const) whole(key, 1)
  whole('restSec', 0)
  if (
    !errors.repMin &&
    !errors.repMax &&
    item.repMin !== undefined &&
    item.repMax !== undefined &&
    item.repMax < item.repMin
  ) {
    errors.repMax = 'The second number must be higher'
  }
  for (const key of REQUIRED[item.type ?? 'check'] ?? []) {
    if (item[key] === undefined && !errors[key]) errors[key] = 'Required for this type'
  }
  return errors
}

/** Drop fields the chosen type does not use (base item only; byWeek is never touched). */
export function withType(item: Item, type: ItemType): Item {
  const keep = new Set<string>(['id', 'exerciseId', 'type', 'unit', 'index', 'logged', 'cue', 'notes', 'rpe', 'alternateExerciseId', 'byWeek', 'retiredFrom', 'progression', ...TYPE_FIELDS[type]])
  const next = { ...item, type } as Record<string, unknown>
  for (const key of Object.keys(next)) if (!keep.has(key)) delete next[key]
  return next as unknown as Item
}

// ── Review (2j) ──

export interface Check {
  label: string
  ok: boolean
  /** The failing day or field, when not ok. */
  detail?: string
}

/** Bounds for the session-length check (EXEC-08 judgment call). */
export const SESSION_MIN = 10
export const SESSION_MAX = 180

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function activeItems(day: Day): Item[] {
  return day.sections.flatMap((s) => s.items.filter((i) => !i.retiredFrom))
}

function dayLabel(day: Day): string {
  return `${DAY_NAMES[day.order] ?? day.id} · ${day.name}`
}

/**
 * The three checks of frame 2j. The second also runs the importer's
 * validator, so a draft that passes all three is a valid program file.
 */
export function reviewChecks(draft: Program): Check[] {
  const training = [...draft.days].filter((d) => !d.rest).sort((a, b) => a.order - b.order)

  const empty = training.filter((day) => activeItems(day).length === 0)
  const first: Check = {
    label: 'Every training day has at least one exercise',
    ok: training.length > 0 && empty.length === 0,
    detail: training.length === 0 ? 'No training days' : empty.map(dayLabel).join(', ') || undefined,
  }

  let fieldProblem: string | undefined
  outer: for (const day of [...draft.days].sort((a, b) => a.order - b.order)) {
    for (const section of day.sections) {
      for (const item of section.items) {
        const errors = itemErrors(item)
        const key = Object.keys(errors)[0] as keyof ItemFields | undefined
        if (key) {
          const name = draft.exercises[item.exerciseId]?.name ?? item.exerciseId
          fieldProblem = `${dayLabel(day)} · ${name}: ${key}`
          break outer
        }
      }
    }
  }
  if (!fieldProblem) {
    const result = importProgram(draft)
    if (!result.ok) fieldProblem = result.errors[0]
  }
  const second: Check = {
    label: 'All sets, reps and rest times are valid',
    ok: fieldProblem === undefined,
    detail: fieldProblem,
  }

  const minutes = training.map((day) => ({ day, min: sessionMinutes(day) }))
  const values = minutes.map((m) => m.min)
  const lo = values.length ? Math.min(...values) : 0
  const hi = values.length ? Math.max(...values) : 0
  const outside = minutes.filter((m) => m.min < SESSION_MIN || m.min > SESSION_MAX)
  const third: Check = {
    label: lo === hi ? `Sessions run about ${lo} minutes` : `Sessions run ${lo} to ${hi} minutes`,
    ok: values.length > 0 && outside.length === 0,
    detail: outside.length
      ? outside.map((m) => `${dayLabel(m.day)}: about ${m.min} min`).join(', ')
      : undefined,
  }
  return [first, second, third]
}

// ── Load and save (D-042 rule 9) ──

/** A draft is a deep copy; nothing is normalised, so an unchanged save is identical. */
export function loadDraft(program: Program): Program {
  return structuredClone(program)
}

/**
 * What Save writes. Days whose sections changed get a fresh durationMin from
 * the formula; untouched days, and an untouched program, come back exactly.
 */
export function finishDraft(draft: Program, original: Program | null): Program {
  const before = new Map((original?.days ?? []).map((d) => [d.id, JSON.stringify(d.sections)]))
  return {
    ...draft,
    days: draft.days.map((day) => {
      if (day.rest || before.get(day.id) === JSON.stringify(day.sections)) return day
      const minutes = sessionMinutes(day)
      return minutes > 0 ? { ...day, durationMin: minutes } : day
    }),
  }
}

/** Load then save with no edits: the JSON a round trip produces. */
export function roundTrip(program: Program): string {
  return JSON.stringify(finishDraft(loadDraft(program), program))
}

// ── Days (2f) ──

/**
 * Move the content at weekday position `from` to position `to`. Content and
 * ids travel together; only `order` values are permuted.
 */
export function moveDay(program: Program, from: number, to: number): Program {
  const sorted = [...program.days].sort((a, b) => a.order - b.order)
  if (to < 0 || to >= sorted.length || from === to) return program
  const orders = sorted.map((d) => d.order)
  const [moved] = sorted.splice(from, 1)
  sorted.splice(to, 0, moved)
  return { ...program, days: sorted.map((day, i) => ({ ...day, order: orders[i] })) }
}

/**
 * Mark two days swappable with each other, both ways; null clears it. Any old
 * pairing of either day is undone first, so pairs never overlap.
 */
export function setSwappable(program: Program, dayId: string, partnerId: string | null): Program {
  const involved = new Set([dayId, partnerId].filter((id): id is string => id !== null))
  return {
    ...program,
    days: program.days.map((day) => {
      const next = { ...day }
      const pairedIn = day.swappableWith !== undefined && involved.has(day.swappableWith)
      if (involved.has(day.id) || pairedIn) delete next.swappableWith
      if (partnerId && day.id === dayId) next.swappableWith = partnerId
      if (partnerId && day.id === partnerId) next.swappableWith = dayId
      return next
    }),
  }
}

// ── Starter days (2b) ──

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Training days that run the same session: same focus (a starter's "Full body
 * A" on Monday and Friday), or the same name when a day has no focus. Weekday
 * order.
 */
export function sessionGroup(program: Program, dayId: string): Day[] {
  const day = program.days.find((d) => d.id === dayId)
  if (!day) return []
  const key = (d: Day) => d.focus ?? d.name
  return program.days
    .filter((d) => !d.rest && key(d) === key(day))
    .sort((a, b) => a.order - b.order)
}

/** "Monday and Friday", "Monday, Wednesday and Friday". */
export function weekdaysLabel(days: Day[]): string {
  const names = days.map((d) => WEEKDAY_NAMES[d.order] ?? d.name)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Swap an exercise across a session group: on every day of the group, items
 * with the same exercise in the same kind of section change. Starter programs
 * have no history, so each swap edits in place.
 */
export function swapInGroup(
  program: Program,
  dayId: string,
  itemId: string,
  entry: LibraryEntry,
): Program {
  const day = program.days.find((d) => d.id === dayId)
  const section = day?.sections.find((s) => s.items.some((i) => i.id === itemId))
  const item = section?.items.find((i) => i.id === itemId)
  if (!day || !section || !item) return program
  let next = withExercise(program, entry)
  const none = new Set<string>()
  for (const d of sessionGroup(program, dayId)) {
    const matches = d.sections
      .filter((s) => s.kind === section.kind)
      .flatMap((s) => s.items)
      .filter((i) => i.exerciseId === item.exerciseId)
    for (const m of matches) next = swapExercise(next, m.id, entry.id, none, '', none)
  }
  return next
}

// ── Blank programs and new items ──

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A new program for the forms path: seven training days, no exercises yet. */
export function blankProgram(id: string, startDate: string): Program {
  return {
    schemaVersion: 2,
    id,
    name: 'My program',
    weekStartsOn: 'sunday',
    programWeeks: 12,
    startDate,
    exercises: {},
    days: WEEKDAYS.map((name, order) => ({
      id: name.slice(0, 3).toLowerCase(),
      order,
      name,
      sections: [],
    })),
  }
}

/** A starting prescription for an exercise just added to a section. */
export function defaultItem(id: string, exerciseId: string, kind: SectionKind, unit: 'kg' | 'lb'): Item {
  if (kind === 'warmup' || kind === 'cooldown' || kind === 'daily') {
    return { id, exerciseId, type: 'check' }
  }
  if (kind === 'cardio') return { id, exerciseId, type: 'cardio_block', minutes: 20 }
  return { id, exerciseId, type: 'load_reps', sets: 3, repMin: 8, repMax: 12, restSec: 90, unit }
}

/**
 * D-059 rule 5: the builder's length hint, shown only when an edit of the
 * current program is at its minimum length (the current week).
 */
export function lengthHint(editing: boolean, currentWeek: number, programWeeks: number): string | null {
  const minWeeks = editing ? Math.max(1, currentWeek) : 1
  return editing && currentWeek > 1 && programWeeks === minWeeks ? `You're in week ${currentWeek}, so the minimum is ${currentWeek} weeks.` : null
}
