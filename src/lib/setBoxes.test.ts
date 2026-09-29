import { describe, expect, it } from 'vitest'

import { formatSetValue } from './prescription.ts'
import { readAmount, readLoadSet, readReps, readWeight } from './setBoxes.ts'

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
