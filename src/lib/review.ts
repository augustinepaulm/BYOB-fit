// AI review pass (D-026, D-043 rule 2): the model proposes a D-025 patch
// against the goal; the user accepts or rejects each line; accepted lines
// edit the base program, with D-042 rules 3 and 4 for items with history.

import type { Item, ItemFields, Program } from '../types/program.ts'
import { findItem, removeItem, swapExercise } from './builder.ts'
import { prescriptionText } from './prescription.ts'
import { resolveItem } from './program.ts'
import { addAdditions, type Proposal } from './reprogram.ts'

export const REVIEW_SYSTEM_PROMPT = `You review a strength-training program against the athlete's goal.

You will be given one JSON message with:
- "task": "review"
- "rules": the athlete's own rules, as plain text
- "goal": the athlete's structured goal (types, targets, timeframe, start date), or null
- "experience" (only when the athlete allows it): "new" or "experienced"
- "currentWeight" (only when the athlete allows it): { "value", "unit" }
- "logged": sessions logged with this program so far, confirmed sets only
- "program": the program as JSON

Return ONLY a JSON object, with no prose and no code fence, of exactly this shape:
{ "week": 0,
  "overrides": [ { "itemId": string, "fields": object, "reason": string } ],
  "add":       [ { "dayId": string, "sectionId": string, "afterItemId": string|null, "item": object, "reason": string } ],
  "remove":    [ { "itemId": string, "reason": string } ],
  "notes": string }

Rules you must follow:
- Change only what the goal or the program's own structure justifies: missing or doubled work for a muscle group, volume or rest that does not fit the goal, an exercise that does not suit the athlete's level. If the program already fits, return empty lists.
- "fields" holds only the item properties you are changing, using the program file's names and types: exerciseId, type, perSide, sets, repMin, repMax, holdSec, distanceM, minutes, tempo, restSec, rpe, unit, index, logged, cue, notes, alternateExerciseId.
- Every itemId, dayId, sectionId and afterItemId must already exist in the program.
- An item you add must carry a new unique "id", an "exerciseId" and a "type". If the exercise is not in the program, include an "exercise" object ({ "name", "howTo" }) alongside "item".
- Weights stay in the unit each item already uses. Never convert between kg and lb.
- Follow the athlete's rules exactly wherever they apply.
- "reason" is one short sentence per change.
- Return the JSON object and nothing else.`

export interface ReviewContext {
  history: Set<string>
  /** ISO date, the day the review is applied. */
  today: string
  loggedToday: Set<string>
}

/** One reviewable line of a proposal, in the order the result screen lists them. */
export type ReviewLine =
  | { key: string; kind: 'override'; index: number }
  | { key: string; kind: 'add'; index: number }
  | { key: string; kind: 'remove'; index: number }

export function reviewLines(proposal: Proposal): ReviewLine[] {
  return [
    ...proposal.overrides.map((_, index) => ({ key: `o${index}`, kind: 'override' as const, index })),
    ...proposal.add.map((_, index) => ({ key: `a${index}`, kind: 'add' as const, index })),
    ...proposal.remove.map((_, index) => ({ key: `r${index}`, kind: 'remove' as const, index })),
  ]
}

/** The proposal cut down to the accepted lines. */
export function acceptedOnly(proposal: Proposal, accepted: Set<string>): Proposal {
  return {
    ...proposal,
    overrides: proposal.overrides.filter((_, i) => accepted.has(`o${i}`)),
    add: proposal.add.filter((_, i) => accepted.has(`a${i}`)),
    remove: proposal.remove.filter((_, i) => accepted.has(`r${i}`)),
  }
}

function replaceItem(program: Program, itemId: string, fn: (item: Item) => Item): Program {
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      sections: day.sections.map((s) => ({ ...s, items: s.items.map((i) => (i.id === itemId ? fn(i) : i)) })),
    })),
  }
}

/**
 * Apply accepted review lines to the base program. A changed exercise on an
 * item with history retires it and continues on a new item (D-042 rule 4);
 * the other changed fields land on whichever item carries on.
 */
export function applyReview(program: Program, accepted: Proposal, ctx: ReviewContext): Program {
  let next: Program = structuredClone(program)

  for (const override of accepted.overrides) {
    const found = findItem(next, override.itemId)
    if (!found) continue
    const { exerciseId, ...rest } = override.fields as ItemFields
    let target = override.itemId
    if (exerciseId !== undefined && exerciseId !== found.item.exerciseId) {
      next = swapExercise(next, override.itemId, exerciseId, ctx.history, ctx.today, ctx.loggedToday)
      if (ctx.history.has(override.itemId)) {
        // The new item sits directly after the retired one.
        const items = findItem(next, override.itemId)!.day.sections.flatMap((s) => s.items)
        target = items[items.findIndex((i) => i.id === override.itemId) + 1].id
      }
    }
    if (Object.keys(rest).length > 0) next = replaceItem(next, target, (item) => ({ ...item, ...rest }))
  }

  addAdditions(next, accepted.add)

  for (const removal of accepted.remove) {
    next = removeItem(next, removal.itemId, ctx.history, ctx.today, ctx.loggedToday)
  }
  return next
}

const PRESCRIPTION_KEYS = new Set(['type', 'sets', 'repMin', 'repMax', 'holdSec', 'distanceM', 'minutes', 'perSide', 'unit'])
const LABEL: Record<string, string> = { restSec: 'rest', tempo: 'tempo', rpe: 'RPE', cue: 'cue', notes: 'notes', index: 'index lift', logged: 'logged', alternateExerciseId: 'alternate' }

function extra(program: Program, key: string, value: unknown): string {
  if (value === undefined) return `${LABEL[key] ?? key} not set`
  if (key === 'restSec') return `rest ${value} s`
  if (key === 'alternateExerciseId') return `alternate ${program.exercises[String(value)]?.name ?? value}`
  if (typeof value === 'boolean') return `${LABEL[key] ?? key} ${value ? 'on' : 'off'}`
  return `${LABEL[key] ?? key} ${value}`
}

/**
 * The line a changed item shows in frames 4c and 4f: its name, and what it
 * reads as before and after ("4 × 6 to 8" → "3 × 6 to 8", "rest 90 s" →
 * "rest 60 s"). An exercise swap reads old name → new name.
 */
export function changeText(program: Program, item: Item, fields: ItemFields, week: number): { name: string; from: string; to: string } {
  const current = resolveItem(item, week)
  const next = { ...current, ...fields }
  const name = program.exercises[current.exerciseId ?? '']?.name ?? current.exerciseId ?? item.id
  if (fields.exerciseId !== undefined && fields.exerciseId !== current.exerciseId) {
    return { name, from: name, to: program.exercises[fields.exerciseId]?.name ?? fields.exerciseId }
  }
  const parts = (fieldsOf: ItemFields) => {
    const out: string[] = []
    if (Object.keys(fields).some((k) => PRESCRIPTION_KEYS.has(k))) out.push(prescriptionText(fieldsOf))
    for (const key of Object.keys(fields)) {
      if (!PRESCRIPTION_KEYS.has(key)) out.push(extra(program, key, (fieldsOf as Record<string, unknown>)[key]))
    }
    return out.join(', ')
  }
  return { name, from: parts(current), to: parts(next) }
}
