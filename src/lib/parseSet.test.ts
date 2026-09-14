import { describe, expect, it } from 'vitest'

import type { SetLog } from '../types/stores.ts'
import { normaliseNumbers, parseSet } from './parseSet.ts'

const load = { type: 'load_reps' } as const
const hold = { type: 'timed_hold' } as const
const bw = { type: 'bodyweight_reps' } as const
const dist = { type: 'distance' } as const
const cardio = { type: 'cardio_block' } as const

function ok(input: string, context: Parameters<typeof parseSet>[1]) {
  const result = parseSet(input, context)
  if (!result.ok) throw new Error(`expected "${input}" to parse, got raw`)
  return result.fields
}

describe('weight and reps', () => {
  it('parses "62.5 for 8"', () => {
    expect(ok('62.5 for 8', load)).toEqual({ weight: 62.5, reps: 8 })
  })

  it('parses "60 x 8"', () => {
    expect(ok('60 x 8', load)).toEqual({ weight: 60, reps: 8 })
  })

  it('parses the × sign', () => {
    expect(ok('60 × 8', load)).toEqual({ weight: 60, reps: 8 })
  })

  it('parses "60 by 8" and "60 times 8"', () => {
    expect(ok('60 by 8', load)).toEqual({ weight: 60, reps: 8 })
    expect(ok('60 times 8', load)).toEqual({ weight: 60, reps: 8 })
  })

  it('ignores a spoken unit, since the item carries it', () => {
    expect(ok('60 kg x 8', load)).toEqual({ weight: 60, reps: 8 })
    expect(ok('135 lbs for 5', load)).toEqual({ weight: 135, reps: 5 })
  })
})

describe('spoken numbers', () => {
  it('parses "twenty two point five for eight"', () => {
    expect(ok('twenty two point five for eight', load)).toEqual({
      weight: 22.5,
      reps: 8,
    })
  })

  it('parses hyphenated tens', () => {
    expect(ok('twenty-two for eight', load)).toEqual({ weight: 22, reps: 8 })
  })

  it('parses "and a half"', () => {
    expect(ok('sixty two and a half for eight', load)).toEqual({
      weight: 62.5,
      reps: 8,
    })
  })

  it('parses a dropped "and a" from dictation', () => {
    expect(ok('sixty two half by eight', load)).toEqual({
      weight: 62.5,
      reps: 8,
    })
  })

  it('parses "one hundred for three"', () => {
    expect(ok('one hundred for three', load)).toEqual({ weight: 100, reps: 3 })
    expect(ok('two hundred for three', load)).toEqual({ weight: 200, reps: 3 })
  })

  it('normalises multi-digit decimals', () => {
    expect(normaliseNumbers('twenty two point two five')).toBe('22.25')
  })
})

describe('seconds, distance, minutes', () => {
  it('parses seconds in every spelling', () => {
    expect(ok('45 s', hold)).toEqual({ seconds: 45 })
    expect(ok('45 sec', hold)).toEqual({ seconds: 45 })
    expect(ok('forty five seconds', hold)).toEqual({ seconds: 45 })
  })

  it('parses metres', () => {
    expect(ok('400 m', dist)).toEqual({ distanceM: 400 })
    expect(ok('400 metres', dist)).toEqual({ distanceM: 400 })
  })

  it('parses minutes, and does not read "min" as metres', () => {
    expect(ok('24 min', cardio)).toEqual({ minutes: 24 })
    expect(ok('24 minutes', cardio)).toEqual({ minutes: 24 })
  })

  it('strips a trailing "per side", which the row already knows', () => {
    expect(ok('30 seconds per side', hold)).toEqual({ seconds: 30 })
  })
})

describe('bare numbers by item type', () => {
  it('reads a bare number as reps for bodyweight_reps', () => {
    expect(ok('12', bw)).toEqual({ reps: 12 })
  })

  it('reads a bare number as seconds for timed_hold', () => {
    expect(ok('45', hold)).toEqual({ seconds: 45 })
  })

  it('reads a bare number as metres for distance', () => {
    expect(ok('400', dist)).toEqual({ distanceM: 400 })
  })

  it('reads a bare number as minutes for cardio_block', () => {
    expect(ok('24', cardio)).toEqual({ minutes: 24 })
  })

  it('flags a bare number on load_reps when there is no load to inherit', () => {
    const result = parseSet('8', load)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.raw).toBe('8')
  })

  it('reads a bare number as reps and inherits the load (EXEC-04 2a)', () => {
    expect(ok('8', { ...load, inheritWeight: 62.5 })).toEqual({
      weight: 62.5,
      reps: 8,
    })
  })

  it('still flags a fractional bare number, which is never a rep count', () => {
    // "sixty two half" normalises to 62.5: a misheard load, not 62.5 reps.
    const result = parseSet('sixty two half', { ...load, inheritWeight: 60 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.raw).toBe('sixty two half')
  })

  it('flags a fractional bare number on bodyweight_reps too', () => {
    expect(parseSet('10.5', bw).ok).toBe(false)
  })
})

describe('bodyweight', () => {
  it('reads "bw x 8" as an explicit zero load', () => {
    expect(ok('bw x 8', bw)).toEqual({ weight: 0, reps: 8 })
  })

  it('reads "bodyweight for 10"', () => {
    expect(ok('bodyweight for 10', bw)).toEqual({ weight: 0, reps: 10 })
  })

  it('reads bare "bodyweight" as weight 0 alone', () => {
    expect(ok('bodyweight', load)).toEqual({ weight: 0 })
  })
})

describe('same', () => {
  const reference: SetLog = { n: 1, weight: 60, reps: 8 }

  it('copies the reference set', () => {
    expect(parseSet('same', { ...load, reference })).toEqual({
      ok: true,
      fields: {
        weight: 60,
        reps: 8,
        seconds: undefined,
        distanceM: undefined,
        minutes: undefined,
      },
    })
  })

  it('flags "same" when there is no reference, rather than zeroing', () => {
    const result = parseSet('same', load)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.raw).toBe('same')
  })
})

describe('never a silent zero', () => {
  it('flags unreadable dictation and keeps the raw text', () => {
    const result = parseSet('sixty too ate', load)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.raw).toBe('sixty too ate')
  })

  it('flags empty input', () => {
    const result = parseSet('   ', load)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.raw).toBe('')
  })

  it('flags a trailing operator with no second number', () => {
    const result = parseSet('60 for', load)
    expect(result.ok).toBe(false)
  })
})
