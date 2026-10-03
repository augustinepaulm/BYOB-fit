// EXEC-13-rework commit G, task 13a: docs/SCORES.md Parts 1 to 5, every
// worked example, and the safety and missing-data rules (D-080).
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { Program } from '../types/program.ts'
import type { BodyEntry, Goals, MealDay, Session } from '../types/stores.ts'
import {
  bodyComparison,
  bodyMeasures,
  bodyScore,
  combine,
  isFinishedSession,
  measureScore,
  noiseBand,
  nutritionCounts,
  nutritionDays,
  nutritionParts,
  trainingCounts,
  trainingParts,
  trendSentence,
  type ScorePart,
} from './scores.ts'

const goal = (...types: Goals['items'][number]['type'][]): Goals => ({
  items: types.map((type, i) => ({ rank: i + 1, type })),
  timeframeWeeks: 12,
  startDate: '2026-08-30',
  updatedAt: 'x',
})

describe('Part 2: training worked example', () => {
  const counts = { planned: 5, finished: 4, prescribed: 68, confirmed: 60, up: 3, same: 6, down: 1, newCount: 0 }
  it('build muscle: 100 × (0.40 × 0.80 + 0.30 × 0.882 + 0.30 × 0.60) = 76.5, shown as 76', () => {
    const parts = trainingParts(counts, 'build_muscle')
    expect(parts.map((p) => p.value)).toEqual([0.8, 60 / 68, 0.6])
    expect(combine(parts)).toBe(76)
  })
  it('lose body fat: progression (3 + 6) ÷ 10 = 0.90, score 85', () => {
    const parts = trainingParts(counts, 'lose_fat')
    expect(parts[2].value).toBe(0.9)
    expect(combine(parts)).toBe(85)
  })
  it('get stronger counts Same as half; no goal counts it fully', () => {
    expect(trainingParts(counts, 'get_stronger')[2].value).toBe(0.6)
    expect(trainingParts(counts, null)[2].value).toBe(0.9)
  })
  it('no comparable exercise: progression drops out', () => {
    expect(trainingParts({ ...counts, up: 0, same: 0, down: 0 }, 'build_muscle')[2].value).toBeNull()
  })
})

describe('Part 3: nutrition worked examples', () => {
  const c = { days: 7, logged: 6, inBand: 4, atProtein: 5, atFibre: 2, hasEnergyTarget: true, hasProteinTarget: true, hasFibreTarget: true }
  it('71 (0.7059 before rounding)', () => {
    expect(combine(nutritionParts(c))).toBe(71)
  })
  it('missing data: no calorie or fibre target, logging and protein at 0.5 each: 85', () => {
    expect(combine(nutritionParts({ ...c, hasEnergyTarget: false, hasFibreTarget: false }))).toBe(85)
  })
})

describe('Part 1: re-weighting and rounding', () => {
  it('a missing part drops out and the others fill its share', () => {
    const parts: ScorePart[] = [
      { key: 'a', weight: 40, value: 1 },
      { key: 'b', weight: 30, value: null },
      { key: 'c', weight: 30, value: 0 },
    ]
    expect(combine(parts)).toBe(57)
  })
  it('no data at all: no score', () => {
    expect(combine([{ key: 'a', weight: 100, value: null }])).toBeNull()
  })
})

describe('Part 5: body', () => {
  const e = (date: string, f: Partial<BodyEntry>, units: 'kg' | 'lb' = 'kg'): BodyEntry => ({ date, units, updatedAt: 'x', ...f })
  it('recomp worked example: muscle +1.1 kg (beyond 0.9) = 1, fat mass −0.5 kg (within 0.7) = 0.5, score 75', () => {
    const entries = [e('2026-09-03', { skeletalMuscle: 33.1, bodyFatMass: 19.1 }), e('2026-10-01', { skeletalMuscle: 34.2, bodyFatMass: 18.6 })]
    const comparison = bodyComparison(entries, bodyMeasures(goal('lose_fat', 'build_muscle')), 'kg')
    expect(comparison?.measures.map((m) => [m.measure, m.change, m.value])).toEqual([
      ['bodyFatMass', -0.5, 0.5],
      ['skeletalMuscle', 1.1, 1],
    ])
    expect(bodyScore(comparison)).toBe(75)
  })
  it('measures by goal', () => {
    expect(bodyMeasures(goal('lose_fat', 'build_muscle'))).toEqual(['bodyFatMass', 'skeletalMuscle'])
    expect(bodyMeasures(goal('lose_fat'))).toEqual(['bodyFatMass', 'bodyFatPct'])
    expect(bodyMeasures(goal('build_muscle'))).toEqual(['skeletalMuscle'])
    // Lose weight: OPEN band, trends only.
    expect(bodyMeasures(goal('lose_weight'))).toEqual([])
    for (const g of ['get_stronger', 'improve_cardio', 'general'] as const) expect(bodyMeasures(goal(g))).toEqual([])
    expect(bodyMeasures(null)).toEqual([])
  })
  it('noise bands, with lb conversions', () => {
    expect(noiseBand('bodyFatPct', 'kg')).toBe(1.0)
    expect(noiseBand('bodyFatMass', 'kg')).toBe(0.7)
    expect(noiseBand('bodyFatMass', 'lb')).toBe(1.5)
    expect(noiseBand('skeletalMuscle', 'kg')).toBe(0.9)
    expect(noiseBand('skeletalMuscle', 'lb')).toBe(2.0)
    expect(noiseBand('weight', 'kg')).toBeNull()
  })
  it('beyond in the goal direction 1, within 0.5, beyond against 0; the band edge is within', () => {
    expect(measureScore(1.1, 0.9, 1)).toBe(1)
    expect(measureScore(0.9, 0.9, 1)).toBe(0.5)
    expect(measureScore(-0.9, 0.9, 1)).toBe(0.5)
    expect(measureScore(-1.0, 0.9, 1)).toBe(0)
    expect(measureScore(-0.8, 0.7, -1)).toBe(1)
    expect(measureScore(1.2, 1.0, -1)).toBe(0)
  })
  it('the reference is 21 to 35 days earlier, closest to 28', () => {
    const entries = [e('2026-09-01', { bodyFatMass: 25 }), e('2026-09-05', { bodyFatMass: 20 }), e('2026-09-09', { bodyFatMass: 19.5 }), e('2026-10-01', { bodyFatMass: 19 })]
    // gaps: 30, 26, 22 days: 26 is closest to 28
    expect(bodyComparison(entries, ['bodyFatMass'], 'kg')?.reference.date).toBe('2026-09-05')
  })
  it('no entry about four weeks earlier: no body score', () => {
    const entries = [e('2026-09-20', { skeletalMuscle: 33 }), e('2026-10-01', { skeletalMuscle: 34 })]
    expect(bodyComparison(entries, ['skeletalMuscle'], 'kg')).toBeNull()
    expect(bodyScore(null)).toBeNull()
  })
  it('compares in the display unit with that unit’s band', () => {
    const entries = [e('2026-09-03', { bodyFatMass: 19.1 }), e('2026-10-01', { bodyFatMass: 40 }, 'lb')]
    const c = bodyComparison(entries, ['bodyFatMass'], 'lb')!
    expect(c.measures[0].band).toBe(1.5)
    expect(c.measures[0].change).toBeCloseTo(40 - 19.1 / 0.45359237, 1)
  })
})

// A small program: Monday and Thursday train, the rest are rest days.
const program: Program = {
  schemaVersion: 2,
  id: 'p',
  name: 'Test',
  weekStartsOn: 'sunday',
  programWeeks: 4,
  startDate: '2026-09-27',
  exercises: { bench: { name: 'Bench' }, row: { name: 'Row' }, plank: { name: 'Plank' } },
  days: [0, 1, 2, 3, 4, 5, 6].map((order) => {
    const train = order === 1 || order === 4
    return {
      id: `d${order}`,
      order,
      name: train ? `Day ${order}` : 'Rest',
      rest: !train,
      sections: train
        ? [
            { id: `w${order}`, kind: 'warmup' as const, title: 'Warm-up', items: [{ id: `w${order}-1`, exerciseId: 'plank', type: 'check' as const }] },
            {
              id: `m${order}`,
              kind: 'main' as const,
              title: 'Main',
              items: [
                { id: `m${order}-1`, exerciseId: 'bench', type: 'load_reps' as const, sets: 3, repMin: 6, repMax: 8 },
                { id: `m${order}-2`, exerciseId: 'row', type: 'load_reps' as const, sets: 2, repMin: 8, repMax: 10 },
              ],
            },
          ]
        : [],
    }
  }),
} as unknown as Program

const s = (date: string, dayId: string, entries: Session['entries'], ended = true): Session => ({
  id: `${date}__${dayId}`,
  date,
  dayId,
  programWeek: 1,
  startedAt: `${date}T09:00:00Z`,
  ...(ended ? { endedAt: `${date}T10:00:00Z` } : {}),
  entries,
})
const set = (n: number, weight: number, reps: number) => ({ n, weight, reps })

describe('training counts from stored data', () => {
  // Week 1: Mon Sep 28 and Thu Oct 1 planned.
  const today = new Date('2026-10-03T12:00:00')
  it('an empty ended session is not a finished workout (D-080 rule 3, D-086)', () => {
    expect(isFinishedSession(s('2026-09-28', 'd1', []))).toBe(false)
    const c = trainingCounts({ program, changes: [], sessions: [s('2026-09-28', 'd1', [])], week: 1, today })
    expect(c.planned).toBe(2)
    expect(c.finished).toBe(0)
  })
  it('counts finished dates, and confirmed sets up to the prescribed number', () => {
    const mon = s('2026-09-28', 'd1', [
      { itemId: 'm1-1', exerciseId: 'bench', sets: [set(1, 60, 8), set(2, 60, 8), set(3, 60, 7), set(4, 60, 6)], addedSets: 1 },
      { itemId: 'm1-2', exerciseId: 'row', sets: [set(1, 50, 10)] },
    ])
    const c = trainingCounts({ program, changes: [], sessions: [mon], week: 1, today })
    expect(c.finished).toBe(1)
    // bench 3 of 3 (the added fourth set does not count past 100%), row 1 of 2; the check item is not per-set.
    expect(c.prescribed).toBe(5)
    expect(c.confirmed).toBe(4)
  })
  it('an exercise skipped through Discomfort is left out of completeness', () => {
    const mon = s('2026-09-28', 'd1', [
      { itemId: 'm1-1', exerciseId: 'bench', sets: [set(1, 60, 8)], feltOff: 'discomfort', skipped: true },
      { itemId: 'm1-2', exerciseId: 'row', sets: [set(1, 50, 10), set(2, 50, 10)] },
    ])
    const c = trainingCounts({ program, changes: [], sessions: [mon], week: 1, today })
    expect(c.prescribed).toBe(2)
    expect(c.confirmed).toBe(2)
  })
  it('dates after today are not planned yet; a day change moves the planned workout', () => {
    expect(trainingCounts({ program, changes: [], sessions: [], week: 1, today: new Date('2026-09-29T12:00:00') }).planned).toBe(1)
    const changes = [{ date: '2026-09-29', dayId: 'd4', setAt: 'x' }]
    expect(trainingCounts({ program, changes, sessions: [], week: 1, today: new Date('2026-09-29T12:00:00') }).planned).toBe(2)
  })
  it('progression: the latest top set against the last comparable one; New is left out', () => {
    const before = s('2026-09-21', 'd1', [{ itemId: 'm1-1', exerciseId: 'bench', sets: [set(1, 57.5, 8)] }, { itemId: 'm1-2', exerciseId: 'row', sets: [set(1, 50, 10)] }])
    const mon = s('2026-09-28', 'd1', [
      { itemId: 'm1-1', exerciseId: 'bench', sets: [set(1, 60, 8)] },
      { itemId: 'm1-2', exerciseId: 'row', sets: [set(1, 50, 10)] },
    ])
    const thu = s('2026-10-01', 'd4', [{ itemId: 'm4-1', exerciseId: 'bench', sets: [set(1, 60, 6)] }])
    const c = trainingCounts({ program, changes: [], sessions: [before, mon, thu], week: 1, today })
    // bench latest is Thu (60 × 6) against Mon's 60 × 8 on any day: down; row same.
    expect({ up: c.up, same: c.same, down: c.down, newCount: c.newCount }).toEqual({ up: 0, same: 1, down: 1, newCount: 0 })
    const first = trainingCounts({ program, changes: [], sessions: [mon], week: 1, today })
    expect(first.newCount).toBe(2)
  })
})

describe('nutrition from stored days', () => {
  const targets = { kcal: 1600, proteinG: 150, floorApplied: true, floor: 1500 }
  const day = (date: string, kcal: number, proteinG: number, fibreG?: number): MealDay => ({ date, lines: ['x'], parsed: { kcal, proteinG, ...(fibreG !== undefined ? { fibreG } : {}), items: [{ line: 'x', kcal, proteinG }] } })
  it('a day below the floor is never in range', () => {
    const days = nutritionDays(['2026-10-01', '2026-10-02'], [day('2026-10-01', 1450, 150), day('2026-10-02', 1520, 150)], targets, 22)
    // band: max(1440, 1500) to 1760
    expect(days.map((d) => d.inBand)).toEqual([false, true])
  })
  it('logging counts parsed days; an empty day is not logged; fibre unknown is not at target', () => {
    const days = nutritionDays(['2026-10-01', '2026-10-02', '2026-10-03'], [day('2026-10-01', 1600, 160), { date: '2026-10-02', lines: [] }], targets, 22)
    const c = nutritionCounts(days, targets, 22)
    expect(c).toMatchObject({ days: 3, logged: 1, inBand: 1, atProtein: 1, atFibre: 0 })
  })
})

describe('the view sentences', () => {
  it('compares with the week before', () => {
    expect(trendSentence(76, 73)).toBe('A steady week, up 3 on the one before.')
    expect(trendSentence(85, null)).toBe('A strong week.')
    expect(trendSentence(50, 55)).toBe('A lighter week, down 5 on the one before.')
    expect(trendSentence(null, 50)).toBe('No score this week.')
  })
  it('scores are pure: no storage and no AI in scores.ts', () => {
    const source = readFileSync(new URL('./scores.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/from '\.\.\/db|sendAndLog|anthropic/)
  })
})
