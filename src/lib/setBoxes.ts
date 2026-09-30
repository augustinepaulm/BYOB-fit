// The two boxes of a load_reps set row, and the one box of other types
// (D-051, EXEC-11.1 task 4). Pure: text in, a number or a short error out.
// Number words from keyboard dictation go through normaliseNumbers.

import { normaliseNumbers } from './parseSet.ts'

export type BoxResult = { ok: true; value: number } | { ok: false; error: string }

const WEIGHT_UNITS = ['kg', 'kgs', 'lb', 'lbs', 'pound', 'pounds']
const REPS_UNITS = ['rep', 'reps']

/**
 * One number, optionally followed by one unit word. A comma is a decimal
 * separator only when it is the only separator ("62,5"). A leading minus is
 * refused here, since normaliseNumbers reads "-" as a space.
 */
function readNumber(text: string, units: string[]): number | 'empty' | 'negative' | null {
  let t = text.trim().toLowerCase()
  if (t === '') return 'empty'
  if (/(^|\s)-\s*\d/.test(t) || /^-/.test(t)) return 'negative'
  if (t.includes(',')) {
    if (t.includes('.') || (t.match(/,/g) ?? []).length > 1 || !/\d,\d/.test(t) || /,\s/.test(t)) return null
    t = t.replace(',', '.')
  }
  const tokens = normaliseNumbers(t).split(' ').filter(Boolean)
  if (tokens.length === 2 && units.includes(tokens[1])) tokens.pop()
  if (tokens.length !== 1 || !/^\d+(?:\.\d+)?$/.test(tokens[0])) return null
  return Number(tokens[0])
}

/** A weight of at least 0; decimals allowed. */
export function readWeight(text: string): BoxResult {
  const n = readNumber(text, WEIGHT_UNITS)
  if (n === 'empty') return { ok: false, error: 'Enter a weight' }
  if (n === 'negative') return { ok: false, error: 'Weight can’t be below 0' }
  if (n === null) return { ok: false, error: 'Enter a number, like 62.5' }
  return { ok: true, value: n }
}

/** Reps: a whole number of at least 1. */
export function readReps(text: string): BoxResult {
  const n = readNumber(text, REPS_UNITS)
  if (n === 'empty') return { ok: false, error: 'Enter reps' }
  if (n === 'negative' || n === 0) return { ok: false, error: 'Reps must be at least 1' }
  if (n === null) return { ok: false, error: 'Enter a number, like 8' }
  if (!Number.isInteger(n)) return { ok: false, error: 'Reps must be a whole number' }
  return { ok: true, value: n }
}

/** The single box of other item types: seconds, meters, minutes or reps. */
export function readAmount(text: string, kind: 'reps' | 'seconds' | 'meters' | 'minutes'): BoxResult {
  if (kind === 'reps') return readReps(text)
  const units = { seconds: ['s', 'sec', 'secs', 'second', 'seconds'], meters: ['m', 'meter', 'meters', 'metre', 'metres'], minutes: ['min', 'mins', 'minute', 'minutes'] }[kind]
  const n = readNumber(text, units)
  if (n === 'empty') return { ok: false, error: `Enter ${kind}` }
  if (n === 'negative' || n === 0) return { ok: false, error: 'Must be more than 0' }
  if (n === null) return { ok: false, error: 'Enter a number' }
  if (kind === 'seconds' && !Number.isInteger(n)) return { ok: false, error: 'Seconds must be a whole number' }
  return { ok: true, value: n }
}

export type LoadSetResult =
  | { ok: true; weight: number; reps: number }
  | { ok: false; weight: BoxResult; reps: BoxResult }

/**
 * A load_reps row: both boxes must read. An empty box takes its visible
 * placeholder when there is one; an empty Weight with none is "Enter a weight".
 */
export function readLoadSet(weightText: string, repsText: string, placeholders: { weight?: number; reps?: number }): LoadSetResult {
  const weight: BoxResult =
    weightText.trim() === '' && placeholders.weight !== undefined ? { ok: true, value: placeholders.weight } : readWeight(weightText)
  const reps: BoxResult =
    repsText.trim() === '' && placeholders.reps !== undefined ? { ok: true, value: placeholders.reps } : readReps(repsText)
  return weight.ok && reps.ok ? { ok: true, weight: weight.value, reps: reps.value } : { ok: false, weight, reps }
}

// ── What a row saves (D-053) ──

/** "8–12", or "8" when the range is one number; '' with no reps prescribed. */
export function repRangeText(repMin?: number, repMax?: number): string {
  if (repMin !== undefined && repMax !== undefined) return repMin === repMax ? String(repMin) : `${repMin}–${repMax}`
  return String(repMin ?? repMax ?? '')
}

export type RowAction = 'tick' | 'done'

export type LoadRowOutcome =
  | { kind: 'save'; weight: number; reps: number }
  | { kind: 'skip' }
  | { kind: 'invalid'; weight: BoxResult; reps: BoxResult }

/**
 * D-053: a pre-fill never becomes data. An untouched row saves only last
 * week's values for that row; without them Done leaves it empty and the tick
 * asks for reps. The set above's weight is a placeholder used only once reps
 * are typed.
 */
export function loadRowOutcome(
  input: { weightText: string; repsText: string; reference?: { weight?: number; reps?: number }; weightAbove?: number },
  action: RowAction,
): LoadRowOutcome {
  const { reference } = input
  const untouched = input.weightText.trim() === '' && input.repsText.trim() === ''
  if (untouched) {
    if (reference?.weight !== undefined && reference.reps !== undefined) return { kind: 'save', weight: reference.weight, reps: reference.reps }
    if (action === 'done') return { kind: 'skip' }
  }
  const result = readLoadSet(input.weightText, input.repsText, { weight: reference?.weight ?? input.weightAbove, reps: reference?.reps })
  return result.ok ? { kind: 'save', weight: result.weight, reps: result.reps } : { kind: 'invalid', weight: result.weight, reps: result.reps }
}

export type SingleRowOutcome = { kind: 'save'; value: number } | { kind: 'skip' } | { kind: 'invalid'; value: BoxResult }

/** One-box types, same rule: an untouched box saves only last week's value. */
export function singleRowOutcome(
  text: string,
  kind: 'reps' | 'seconds' | 'meters' | 'minutes',
  reference: number | undefined,
  action: RowAction,
): SingleRowOutcome {
  if (text.trim() === '') {
    if (reference !== undefined) return { kind: 'save', value: reference }
    if (action === 'done') return { kind: 'skip' }
  }
  const value = readAmount(text, kind)
  return value.ok ? { kind: 'save', value: value.value } : { kind: 'invalid', value }
}

/**
 * D-054 rule 1: the attributes every number box in the deck carries. A
 * neutral name equal to the id, and no autocomplete value naming a purpose.
 */
export function numberBoxAttributes(id: string) {
  return {
    id,
    name: id,
    type: 'text',
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
  } as const
}
