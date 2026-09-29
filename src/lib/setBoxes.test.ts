import { describe, expect, it } from 'vitest'

import { formatSetValue } from './prescription.ts'
import type { Exercise, ItemFields } from '../types/program.ts'
import type { Entry, SetLog } from '../types/stores.ts'
import { suggestProgression } from './progression.ts'
import {
  loadRowOutcome,
  readAmount,
  readLoadSet,
  readReps,
  readWeight,
  repRangeText,
  singleRowOutcome,
  type RowAction,
} from './setBoxes.ts'

const ok = (value: number) => ({ ok: true, value })

describe('readWeight (D-051)', () => {
  it('accepts digits, a unit word, decimals and number words', () => {
    expect(readWeight('135')).toEqual(ok(135))
    expect(readWeight('135 lbs')).toEqual(ok(135))
    expect(readWeight('135 lb')).toEqual(ok(135))
    expect(readWeight('60 kg')).toEqual(ok(60))
    expect(readWeight('100 pounds')).toEqual(ok(100))
    expect(readWeight('62.5')).toEqual(ok(62.5))
    expect(readWeight('sixty two point five')).toEqual(ok(62.5))
    expect(readWeight('0')).toEqual(ok(0))
  })
  it('reads a comma as the decimal separator only when it is the only one', () => {
    expect(readWeight('62,5')).toEqual(ok(62.5))
    expect(readWeight('62,5 kg')).toEqual(ok(62.5))
    expect(readWeight('1,062.5').ok).toBe(false)
    expect(readWeight('5, 135').ok).toBe(false)
    expect(readWeight('1,2,3').ok).toBe(false)
  })
  it('rejects empty, negative, text and two numbers, with a short message', () => {
    expect(readWeight('')).toEqual({ ok: false, error: 'Enter a weight' })
    expect(readWeight('-5')).toEqual({ ok: false, error: 'Weight can’t be below 0' })
    expect(readWeight('abc')).toEqual({ ok: false, error: 'Enter a number, like 62.5' })
    expect(readWeight('135 5').ok).toBe(false)
    expect(readWeight('135 reps').ok).toBe(false)
  })
})

describe('readReps (D-051)', () => {
  it('accepts whole numbers, a unit word and number words', () => {
    expect(readReps('5')).toEqual(ok(5))
    expect(readReps('5 reps')).toEqual(ok(5))
    expect(readReps('1 rep')).toEqual(ok(1))
    expect(readReps('five')).toEqual(ok(5))
    expect(readReps('twelve')).toEqual(ok(12))
  })
  it('rejects empty, negative, zero, decimals and text', () => {
    expect(readReps('')).toEqual({ ok: false, error: 'Enter reps' })
    expect(readReps('-5')).toEqual({ ok: false, error: 'Reps must be at least 1' })
    expect(readReps('0')).toEqual({ ok: false, error: 'Reps must be at least 1' })
    expect(readReps('5.5')).toEqual({ ok: false, error: 'Reps must be a whole number' })
    expect(readReps('abc')).toEqual({ ok: false, error: 'Enter a number, like 8' })
    expect(readReps('5 kg').ok).toBe(false)
  })
})

describe('readAmount: one box for other types', () => {
  it('reads seconds, meters, minutes and reps with their unit words', () => {
    expect(readAmount('45', 'seconds')).toEqual(ok(45))
    expect(readAmount('45 s', 'seconds')).toEqual(ok(45))
    expect(readAmount('forty five seconds', 'seconds')).toEqual(ok(45))
    expect(readAmount('400 m', 'meters')).toEqual(ok(400))
    expect(readAmount('12.5', 'minutes')).toEqual(ok(12.5))
    expect(readAmount('10 reps', 'reps')).toEqual(ok(10))
  })
  it('rejects empty, zero and text', () => {
    expect(readAmount('', 'seconds').ok).toBe(false)
    expect(readAmount('0', 'meters').ok).toBe(false)
    expect(readAmount('abc', 'minutes').ok).toBe(false)
    expect(readAmount('4.5', 'seconds').ok).toBe(false)
  })
})

describe('the defect from D-051, through the two boxes (EXEC-11.1 task 3)', () => {
  // Each entry Auggie typed meant weight 135 and reps 5; the single field
  // rejected all five. Through the boxes, each written form saves 135 × 5.
  const weights = ['135', '135 lbs', '135 lb', '135 pounds']
  const reps = ['5', '5 reps', 'five']
  for (const w of weights) {
    for (const r of reps) {
      it(`Weight "${w}" and Reps "${r}" save as 135 × 5`, () => {
        const result = readLoadSet(w, r, {})
        expect(result).toEqual({ ok: true, weight: 135, reps: 5 })
        if (result.ok) expect(formatSetValue(result)).toBe('135 × 5')
      })
    }
  }
  it('Reps 5 alone on a first session: "Enter a weight", nothing saved', () => {
    expect(readLoadSet('', '5', { reps: 8 })).toEqual({ ok: false, weight: { ok: false, error: 'Enter a weight' }, reps: { ok: true, value: 5 } })
  })
  it('with last week as the placeholder, Reps alone saves', () => {
    expect(readLoadSet('', '5', { weight: 135, reps: 8 })).toEqual({ ok: true, weight: 135, reps: 5 })
  })
  it('an invalid box reports itself and saves nothing', () => {
    const result = readLoadSet('abc', '5.5', { weight: 135 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.weight).toEqual({ ok: false, error: 'Enter a number, like 62.5' })
      expect(result.reps).toEqual({ ok: false, error: 'Reps must be a whole number' })
    }
  })
})

// ── D-053: a pre-fill never becomes data (EXEC-11.2 task 5) ──

/**
 * One session of one load item as the deck runs it: each row is either typed
 * and ticked, or left untouched when Done is tapped. The weight placeholder
 * comes from the nearest set saved above, as in the deck.
 */
function runSession(rows: ({ weight: string; reps: string } | null)[], lastWeek: SetLog[] = []): SetLog[] {
  const saved: SetLog[] = []
  rows.forEach((typed, i) => {
    const n = i + 1
    const action: RowAction = typed ? 'tick' : 'done'
    const reference = lastWeek.find((set) => set.n === n)
    const weightAbove = [...saved].reverse().find((set) => set.weight !== undefined)?.weight
    const outcome = loadRowOutcome({ weightText: typed?.weight ?? '', repsText: typed?.reps ?? '', reference, weightAbove }, action)
    if (outcome.kind === 'save') saved.push({ n, weight: outcome.weight, reps: outcome.reps })
  })
  return saved
}

describe('pre-fills never become data (D-053)', () => {
  it('the task 3 case: set 1 typed 135 × 5 and ticked, then Done: sets 2 and 3 stay empty', () => {
    // Before the fix, Done saved sets 2 and 3 as 135 × 12 (the set above's weight, the range top).
    expect(runSession([{ weight: '135', reps: '5' }, null, null])).toEqual([{ n: 1, weight: 135, reps: 5 }])
  })

  it('second session: Done on untouched rows saves exactly last week\'s values', () => {
    const lastWeek = [
      { n: 1, weight: 135, reps: 5 },
      { n: 2, weight: 135, reps: 6 },
      { n: 3, weight: 140, reps: 4 },
    ]
    expect(runSession([null, null, null], lastWeek)).toEqual(lastWeek)
    // A typed row still wins over last week.
    expect(runSession([{ weight: '', reps: '7' }, null, null], lastWeek)).toEqual([{ n: 1, weight: 135, reps: 7 }, lastWeek[1], lastWeek[2]])
  })

  it('first session: the tick with Reps empty shows "Enter reps" and saves nothing', () => {
    const outcome = loadRowOutcome({ weightText: '', repsText: '', weightAbove: 135 }, 'tick')
    expect(outcome).toEqual({ kind: 'invalid', weight: { ok: true, value: 135 }, reps: { ok: false, error: 'Enter reps' } })
    expect(loadRowOutcome({ weightText: '135', repsText: '' }, 'tick')).toMatchObject({ kind: 'invalid', reps: { ok: false, error: 'Enter reps' } })
    expect(loadRowOutcome({ weightText: '', repsText: '' }, 'tick')).toEqual({
      kind: 'invalid',
      weight: { ok: false, error: 'Enter a weight' },
      reps: { ok: false, error: 'Enter reps' },
    })
  })

  it('first session: typed Reps with the Weight placeholder from the set above saves', () => {
    expect(loadRowOutcome({ weightText: '', repsText: '6', weightAbove: 135 }, 'tick')).toEqual({ kind: 'save', weight: 135, reps: 6 })
    expect(runSession([{ weight: '135', reps: '5' }, { weight: '', reps: '6' }, null])).toEqual([
      { n: 1, weight: 135, reps: 5 },
      { n: 2, weight: 135, reps: 6 },
    ])
  })

  it('one-box types: an untouched box saves only last week\'s value', () => {
    expect(singleRowOutcome('', 'seconds', undefined, 'done')).toEqual({ kind: 'skip' })
    expect(singleRowOutcome('', 'seconds', undefined, 'tick')).toEqual({ kind: 'invalid', value: { ok: false, error: 'Enter seconds' } })
    expect(singleRowOutcome('', 'seconds', 40, 'done')).toEqual({ kind: 'save', value: 40 })
    expect(singleRowOutcome('45', 'seconds', undefined, 'done')).toEqual({ kind: 'save', value: 45 })
  })

  it('the Reps placeholder shows the range without last week', () => {
    expect(repRangeText(8, 12)).toBe('8–12')
    expect(repRangeText(10, 10)).toBe('10')
    expect(repRangeText(8, undefined)).toBe('8')
    expect(repRangeText(undefined, undefined)).toBe('')
  })

  it('suggestProgression: null for an item whose first session ended with Done after one typed set', () => {
    const goblet: ItemFields = { exerciseId: 'goblet-squat', type: 'load_reps', sets: 3, repMin: 8, repMax: 12, unit: 'lb' }
    const exercise: Exercise = { name: 'Goblet squat', howTo: '', muscles: ['legs', 'glutes'], equipment: 'dumbbell' }
    const entry = (sets: SetLog[]): Entry => ({ itemId: 'i1', exerciseId: 'goblet-squat', sets })
    // Two sessions, each: set 1 typed at the range top, then Done.
    const session = runSession([{ weight: '135', reps: '12' }, null, null])
    expect(session).toEqual([{ n: 1, weight: 135, reps: 12 }])
    expect(suggestProgression(goblet, exercise, [entry(session), entry(session)], 'lb')).toBeNull()
    // What the pre-fix Done wrote (sets 2 and 3 at 135 × 12) would have suggested more weight.
    const prefilled = [1, 2, 3].map((n) => ({ n, weight: 135, reps: 12 }))
    expect(suggestProgression(goblet, exercise, [entry(prefilled), entry(prefilled)], 'lb')).not.toBeNull()
  })
})
