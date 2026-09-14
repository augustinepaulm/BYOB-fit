// Weekly reprogramming (D-016, EXEC-04 task 5). The model proposes a patch;
// nothing reaches storage until the diff is approved.

import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

import schema from '../../docs/program.schema.json'
import type {
  Day,
  Exercise,
  Item,
  ItemFields,
  Program,
  Section,
} from '../types/program.ts'
import type { Profile, Session } from '../types/stores.ts'
import { isSetConfirmed } from './session.ts'

const SCHEMA_ID = 'https://github.com/augustinepaulm/BYOB-fit/program.schema.json'

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
ajv.addSchema(schema as object, SCHEMA_ID)
const validateItemFields = ajv.compile({ $ref: `${SCHEMA_ID}#/$defs/itemFields` })
const validateItem = ajv.compile({ $ref: `${SCHEMA_ID}#/$defs/item` })

export interface Override {
  itemId: string
  fields: ItemFields
  reason: string
}

export interface Addition {
  dayId: string
  sectionId: string
  afterItemId: string | null
  item: Item
  /** Supplied when the added item names an exercise the program lacks. */
  exercise?: Exercise
  reason: string
}

export interface Removal {
  itemId: string
  reason: string
}

export interface Proposal {
  week: number
  overrides: Override[]
  add: Addition[]
  remove: Removal[]
  notes: string
}

export type ProposalResult =
  | { ok: true; proposal: Proposal }
  | { ok: false; errors: string[] }

// ── Prompts ──

export const REPROGRAM_SYSTEM_PROMPT = `You write the next week of a strength-training program for one person.

You will be given: the current program as JSON, the sessions logged this week, the athlete's profile fields, the athlete's own rules, and the target week number.

Return ONLY a JSON object, with no prose and no code fence, of exactly this shape:
{ "week": <target week number>,
  "overrides": [ { "itemId": string, "fields": object, "reason": string } ],
  "add":       [ { "dayId": string, "sectionId": string, "afterItemId": string|null, "item": object, "reason": string } ],
  "remove":    [ { "itemId": string, "reason": string } ],
  "notes": string }

Rules you must follow:
- "fields" holds only the item properties you are changing, using the same names and types as the program file: exerciseId, type, perSide, sets, repMin, repMax, holdSec, distanceM, minutes, tempo, restSec, rpe, unit, index, logged, cue, notes, alternateExerciseId. Omit anything you are not changing.
- Every itemId, dayId, sectionId and afterItemId must already exist in the program you were given.
- An item you add must carry a new unique "id", an "exerciseId" and a "type". If the exercise is not already in the program, include an "exercise" object ({ "name", "howTo" }) alongside "item" and use its new id as "exerciseId".
- Weights stay in the unit each item already uses. Never convert between kg and lb.
- Base every change on the logged sets you were given. Where the log does not support a change, leave the item alone.
- Follow the athlete's rules exactly wherever they apply.
- "reason" is one short sentence a person can check against the log.
- Return the JSON object and nothing else.`

// ── Compaction ──

export interface CompactSet {
  n: number
  side?: 'L' | 'R'
  weight?: number
  reps?: number
  seconds?: number
  distanceM?: number
  minutes?: number
}

export interface CompactSession {
  date: string
  dayId: string
  entries: {
    itemId: string
    exerciseId: string
    sets?: CompactSet[]
    checked?: boolean
    note?: string
  }[]
}

function compactSet(set: CompactSet): CompactSet {
  return Object.fromEntries(
    Object.entries(set).filter(([, value]) => value !== undefined),
  ) as CompactSet
}

/**
 * Sessions trimmed to what the model can act on: what was done, on which day,
 * against which item, with only confirmed sets. Flagged raw text is dropped —
 * it is unverified and would only mislead the proposal.
 */
export function compactSessions(sessions: Session[]): CompactSession[] {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => ({
      date: session.date,
      dayId: session.dayId,
      entries: session.entries.map((entry) => {
        const sets = entry.sets.filter(isSetConfirmed).map((set) =>
          compactSet({
            n: set.n,
            side: set.side,
            weight: set.weight,
            reps: set.reps,
            seconds: set.seconds,
            distanceM: set.distanceM,
            minutes: set.minutes,
          }),
        )
        return {
          itemId: entry.itemId,
          exerciseId: entry.exerciseId,
          ...(sets.length > 0 ? { sets } : {}),
          ...(entry.checked !== undefined ? { checked: entry.checked } : {}),
          ...(entry.note ? { note: entry.note } : {}),
        }
      }),
    }))
}

export function buildReprogramMessage(input: {
  program: Program
  sessions: Session[]
  profile: Profile | undefined
  rules: string
  targetWeek: number
}): string {
  return JSON.stringify(
    {
      targetWeek: input.targetWeek,
      rules: input.rules.trim() === '' ? 'No rules supplied.' : input.rules,
      profile: input.profile?.fields ?? {},
      loggedThisWeek: compactSessions(input.sessions),
      program: input.program,
    },
    null,
    2,
  )
}

// ── Parsing and validation ──

function allItems(program: Program): {
  day: Day
  section: Section
  item: Item
}[] {
  const out: { day: Day; section: Section; item: Item }[] = []
  for (const day of program.days) {
    for (const section of day.sections) {
      for (const item of section.items) out.push({ day, section, item })
    }
  }
  return out
}

export function findItem(program: Program, itemId: string) {
  return allItems(program).find((entry) => entry.item.id === itemId)
}

function ajvErrors(prefix: string, errors: typeof validateItem.errors): string[] {
  return (errors ?? []).map(
    (error) => `${prefix}${error.instancePath}: ${error.message ?? 'is invalid'}`,
  )
}

export function validateProposal(
  value: unknown,
  program: Program,
  targetWeek: number,
): ProposalResult {
  const errors: string[] = []
  const proposal = value as Partial<Proposal>

  if (typeof proposal !== 'object' || proposal === null) {
    return { ok: false, errors: ['/: the response is not a JSON object'] }
  }
  if (proposal.week !== targetWeek) {
    errors.push(`/week: must be ${targetWeek}, got ${JSON.stringify(proposal.week)}`)
  }
  for (const key of ['overrides', 'add', 'remove'] as const) {
    if (proposal[key] !== undefined && !Array.isArray(proposal[key])) {
      errors.push(`/${key}: must be an array`)
    }
  }

  const overrides = Array.isArray(proposal.overrides) ? proposal.overrides : []
  const additions = Array.isArray(proposal.add) ? proposal.add : []
  const removals = Array.isArray(proposal.remove) ? proposal.remove : []

  overrides.forEach((override, i) => {
    const at = `/overrides/${i}`
    if (!override?.itemId || !findItem(program, override.itemId)) {
      errors.push(`${at}/itemId: no item with id "${override?.itemId}"`)
    }
    if (typeof override?.fields !== 'object' || override.fields === null) {
      errors.push(`${at}/fields: must be an object`)
    } else if (Object.keys(override.fields).length === 0) {
      errors.push(`${at}/fields: changes nothing`)
    } else if (!validateItemFields(override.fields)) {
      errors.push(...ajvErrors(`${at}/fields`, validateItemFields.errors))
    } else if (
      override.fields.exerciseId !== undefined &&
      !Object.prototype.hasOwnProperty.call(
        program.exercises,
        override.fields.exerciseId,
      )
    ) {
      errors.push(
        `${at}/fields/exerciseId: no exercise with id "${override.fields.exerciseId}"`,
      )
    }
  })

  const knownItemIds = new Set(allItems(program).map((entry) => entry.item.id))
  additions.forEach((addition, i) => {
    const at = `/add/${i}`
    const day = program.days.find((d) => d.id === addition?.dayId)
    if (!day) {
      errors.push(`${at}/dayId: no day with id "${addition?.dayId}"`)
      return
    }
    const section = day.sections.find((s) => s.id === addition.sectionId)
    if (!section) {
      errors.push(
        `${at}/sectionId: day "${addition.dayId}" has no section "${addition.sectionId}"`,
      )
      return
    }
    if (
      addition.afterItemId !== null &&
      addition.afterItemId !== undefined &&
      !section.items.some((item) => item.id === addition.afterItemId)
    ) {
      errors.push(
        `${at}/afterItemId: section "${addition.sectionId}" has no item "${addition.afterItemId}"`,
      )
    }
    if (!validateItem(addition.item)) {
      errors.push(...ajvErrors(`${at}/item`, validateItem.errors))
      return
    }
    if (knownItemIds.has(addition.item.id)) {
      errors.push(`${at}/item/id: "${addition.item.id}" is already used`)
    }
    knownItemIds.add(addition.item.id)
    const known = Object.prototype.hasOwnProperty.call(
      program.exercises,
      addition.item.exerciseId,
    )
    if (!known && !addition.exercise) {
      errors.push(
        `${at}/item/exerciseId: no exercise with id "${addition.item.exerciseId}", and no "exercise" object was supplied`,
      )
    }
    if (addition.exercise && typeof addition.exercise.name !== 'string') {
      errors.push(`${at}/exercise/name: must be a string`)
    }
  })

  removals.forEach((removal, i) => {
    if (!removal?.itemId || !findItem(program, removal.itemId)) {
      errors.push(`/remove/${i}/itemId: no item with id "${removal?.itemId}"`)
    }
  })

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    proposal: {
      week: targetWeek,
      overrides,
      add: additions,
      remove: removals,
      notes: typeof proposal.notes === 'string' ? proposal.notes : '',
    },
  }
}

// ── Applying ──

/** Apply an approved proposal, returning a new program. Never mutates input. */
export function applyProposal(program: Program, proposal: Proposal): Program {
  const next: Program = structuredClone(program)
  const week = String(proposal.week)

  for (const override of proposal.overrides) {
    const found = findItem(next, override.itemId)
    if (!found) continue
    // Merged over any existing key for the target week, so two rounds of
    // proposals for the same week accumulate rather than replace.
    found.item.byWeek = {
      ...found.item.byWeek,
      [week]: { ...found.item.byWeek?.[week], ...override.fields },
    }
  }

  for (const addition of proposal.add) {
    const day = next.days.find((d) => d.id === addition.dayId)
    const section = day?.sections.find((s) => s.id === addition.sectionId)
    if (!section) continue
    if (addition.exercise) {
      next.exercises[addition.item.exerciseId] = addition.exercise
    }
    const at =
      addition.afterItemId === null || addition.afterItemId === undefined
        ? -1
        : section.items.findIndex((item) => item.id === addition.afterItemId)
    section.items.splice(at + 1, 0, structuredClone(addition.item))
  }

  const removing = new Set(proposal.remove.map((removal) => removal.itemId))
  for (const day of next.days) {
    for (const section of day.sections) {
      section.items = section.items.filter((item) => !removing.has(item.id))
    }
  }

  return next
}

// ── Diff for the approval view ──

const FIELD_LABELS: Record<string, string> = {
  exerciseId: 'exercise',
  type: 'type',
  perSide: 'per side',
  sets: 'sets',
  repMin: 'min reps',
  repMax: 'max reps',
  holdSec: 'hold',
  distanceM: 'distance',
  minutes: 'minutes',
  tempo: 'tempo',
  restSec: 'rest',
  rpe: 'RPE',
  unit: 'unit',
  index: 'index lift',
  logged: 'logged',
  cue: 'cue',
  notes: 'notes',
  alternateExerciseId: 'alternate',
}

function fieldValue(
  program: Program,
  key: string,
  value: unknown,
): string {
  if (value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (key === 'exerciseId' || key === 'alternateExerciseId') {
    return program.exercises[String(value)]?.name ?? String(value)
  }
  if (key === 'holdSec') return `${value} s`
  if (key === 'distanceM') return `${value} m`
  if (key === 'minutes') return `${value} min`
  if (key === 'restSec') return `${value} s`
  return String(value)
}

export interface DiffField {
  label: string
  from: string
  to: string
}

export interface DiffRow {
  kind: 'changed' | 'added' | 'removed'
  name: string
  perSide: boolean
  /** The item already carries an override for the target week. */
  mergesExisting: boolean
  fields: DiffField[]
  summary: string
  reason: string
}

export interface DiffGroup {
  dayId: string
  title: string
  rows: DiffRow[]
}

/**
 * Grouped by day, in program order. An override shows one line per field it
 * actually changes, measured against the value in force in the current week —
 * so a value that a byWeek key already changed shows that key's value as "from",
 * not the item's base value.
 */
export function buildDiff(
  program: Program,
  proposal: Proposal,
  currentWeek: number,
  resolve: (item: Item, week: number) => ItemFields & { id: string },
  describe: (fields: ItemFields) => string,
): DiffGroup[] {
  const groups = new Map<string, DiffGroup>()
  const groupFor = (day: Day): DiffGroup => {
    const existing = groups.get(day.id)
    if (existing) return existing
    const created: DiffGroup = {
      dayId: day.id,
      title: day.focus ? `${day.name} · ${day.focus}` : day.name,
      rows: [],
    }
    groups.set(day.id, created)
    return created
  }
  // Seed in program order so days read Sunday-first regardless of patch order.
  for (const day of program.days) {
    if (
      proposal.overrides.some(
        (override) => findItem(program, override.itemId)?.day.id === day.id,
      ) ||
      proposal.add.some((addition) => addition.dayId === day.id) ||
      proposal.remove.some(
        (removal) => findItem(program, removal.itemId)?.day.id === day.id,
      )
    ) {
      groupFor(day)
    }
  }

  for (const override of proposal.overrides) {
    const found = findItem(program, override.itemId)
    if (!found) continue
    const current = resolve(found.item, currentWeek)
    const fields: DiffField[] = []
    for (const [key, value] of Object.entries(override.fields)) {
      const before = (current as unknown as Record<string, unknown>)[key]
      if (JSON.stringify(before) === JSON.stringify(value)) continue
      fields.push({
        label: FIELD_LABELS[key] ?? key,
        from: fieldValue(program, key, before),
        to: fieldValue(program, key, value),
      })
    }
    if (fields.length === 0) continue
    groupFor(found.day).rows.push({
      kind: 'changed',
      name:
        program.exercises[current.exerciseId ?? '']?.name ??
        current.exerciseId ??
        override.itemId,
      perSide: current.perSide === true || override.fields.perSide === true,
      mergesExisting:
        found.item.byWeek?.[String(proposal.week)] !== undefined,
      fields,
      summary: describe({ ...current, ...override.fields }),
      reason: override.reason,
    })
  }

  for (const addition of proposal.add) {
    const day = program.days.find((d) => d.id === addition.dayId)
    if (!day) continue
    const name =
      addition.exercise?.name ??
      program.exercises[addition.item.exerciseId]?.name ??
      addition.item.exerciseId
    groupFor(day).rows.push({
      kind: 'added',
      name,
      perSide: addition.item.perSide === true,
      mergesExisting: false,
      fields: [],
      summary: describe(addition.item),
      reason: addition.reason,
    })
  }

  for (const removal of proposal.remove) {
    const found = findItem(program, removal.itemId)
    if (!found) continue
    const current = resolve(found.item, currentWeek)
    groupFor(found.day).rows.push({
      kind: 'removed',
      name:
        program.exercises[current.exerciseId ?? '']?.name ??
        current.exerciseId ??
        removal.itemId,
      perSide: current.perSide === true,
      mergesExisting: false,
      fields: [],
      summary: describe(current),
      reason: removal.reason,
    })
  }

  return [...groups.values()].filter((group) => group.rows.length > 0)
}
