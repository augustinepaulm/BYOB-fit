// EXEC-13-rework commit E, task 11 (D-078): body entries, units, changes and BMR.
import { describe, expect, it } from 'vitest'

import type { BodyEntry, Goals } from '../types/stores.ts'
import { changeText, entryFrom, historyLine, latestValues, parseBodyValue, recentBmr, valueIn } from './body.ts'
import { computeTargets } from './targets.ts'

const NOW = new Date('2026-10-03T08:00:00.000Z')
const e = (date: string, fields: Partial<BodyEntry>, units: 'kg' | 'lb' = 'kg'): BodyEntry => ({ date, units, updatedAt: NOW.toISOString(), ...fields })

describe('entries (D-078 rule 1)', () => {
  it('one field is a whole entry', () => {
    expect(entryFrom('2026-10-03', 'kg', { weight: 83 }, NOW)).toEqual({ date: '2026-10-03', units: 'kg', weight: 83, updatedAt: NOW.toISOString() })
  })
  it('nothing entered is no entry', () => {
    expect(entryFrom('2026-10-03', 'kg', {}, NOW)).toBeUndefined()
  })
  it('every field is optional and kept', () => {
    const all = { weight: 83, skeletalMuscle: 34.2, bodyFatMass: 18.6, bodyFatPct: 22.4, visceralFat: 8, bmrKcal: 1810, waist: 88, chest: 104, hips: 99, upperArm: 35, thigh: 58 }
    expect(entryFrom('2026-10-01', 'kg', all, NOW)).toEqual({ date: '2026-10-01', units: 'kg', updatedAt: NOW.toISOString(), ...all })
  })
  it('a typed box must be a positive number; empty is not entered', () => {
    expect(parseBodyValue('')).toEqual({ ok: true, value: undefined })
    expect(parseBodyValue(' 83,4 ')).toEqual({ ok: true, value: 83.4 })
    expect(parseBodyValue('abc').ok).toBe(false)
    expect(parseBodyValue('0').ok).toBe(false)
  })
})

describe('latest values and the change since the entry before (frame 3.06)', () => {
  const entries = [
    e('2026-09-03', { weight: 84.1, skeletalMuscle: 33.1, bodyFatMass: 19.1, bodyFatPct: 22.7, visceralFat: 8 }),
    e('2026-09-24', { weight: 83.4 }),
    e('2026-10-01', { weight: 83.0, skeletalMuscle: 33.4, bodyFatMass: 18.9, bodyFatPct: 22.4, visceralFat: 8 }),
  ]
  const latest = latestValues(entries, 'kg')
  it('weight against the entry before', () => {
    expect(latest.weight).toMatchObject({ value: 83.0, date: '2026-10-01', change: -0.4, good: null })
    expect(changeText(-0.4, 'mass', 'kg')).toBe('−0.4 kg')
  })
  it('composition against the entry before that had it', () => {
    expect(latest.skeletalMuscle).toMatchObject({ value: 33.4, change: 0.3, good: true })
    expect(latest.bodyFatMass).toMatchObject({ change: -0.2, good: true })
    expect(latest.bodyFatPct).toMatchObject({ change: -0.3, good: true })
    expect(changeText(-0.3, 'percent', 'kg')).toBe('−0.3 points')
    expect(latest.visceralFat).toMatchObject({ value: 8, change: 0, good: null })
    expect(changeText(0, 'level', 'kg')).toBe('No change')
  })
  it('a single entry has no change', () => {
    expect(latestValues([entries[0]], 'kg').weight?.change).toBeUndefined()
  })
  it('fields never entered are absent', () => {
    expect(latest.bmrKcal).toBeUndefined()
    expect(latest.waist).toBeUndefined()
  })
})

describe('units (D-078 rule 2)', () => {
  it('masses follow the display unit; lengths are cm with kg and inches with lb', () => {
    const entry = e('2026-10-01', { weight: 100, waist: 2.54 * 34 })
    expect(valueIn(entry, 'weight', 'lb')).toBeCloseTo(220.46, 2)
    expect(valueIn(entry, 'waist', 'lb')).toBeCloseTo(34, 6)
    expect(valueIn(e('2026-10-01', { weight: 220.462 }, 'lb'), 'weight', 'kg')).toBeCloseTo(100, 2)
    expect(valueIn(entry, 'bodyFatPct', 'lb')).toBeUndefined()
  })
  it('history lines read as frame 3.08', () => {
    expect(historyLine(e('2026-10-01', { weight: 83, skeletalMuscle: 34.2, bodyFatMass: 18.6 }), 'kg')).toBe('Scan · 83.0 kg · muscle 34.2 · fat 18.6')
    expect(historyLine(e('2026-09-24', { weight: 83.4 }), 'kg')).toBe('Weight 83.4 kg')
  })
})

describe('BMR as resting energy (D-078 rule 3)', () => {
  const goals: Goals = {
    items: [{ rank: 1, type: 'lose_weight' }],
    timeframeWeeks: 12,
    startDate: '2026-09-01',
    currentStats: { weight: 90, weightUnit: 'kg', heightCm: 180, age: 40, sex: 'male', activity: 'active' },
    updatedAt: '2026-09-01T00:00:00Z',
  }
  it('the TARGETS worked example is unchanged without a BMR', () => {
    expect(computeTargets(goals)).toEqual({ kcal: 2720, proteinG: 180, floorApplied: false, resting: { source: 'formula' } })
    expect(computeTargets(goals, [e('2026-10-01', { weight: 83 })], '2026-10-03')).toEqual({ kcal: 2720, proteinG: 180, floorApplied: false, resting: { source: 'formula' } })
  })
  it('a BMR within 8 weeks replaces Mifflin-St Jeor; the factor and adjustment still apply', () => {
    // 1800 × 1.76 − 500 = 2668 → 2670
    expect(computeTargets(goals, [e('2026-08-08', { bmrKcal: 1800 })], '2026-10-03')).toEqual({ kcal: 2670, proteinG: 180, floorApplied: false, resting: { source: 'bmr', date: '2026-08-08' } })
  })
  it('exactly 8 weeks old still counts; a day older does not', () => {
    expect(recentBmr([e('2026-08-08', { bmrKcal: 1800 })], '2026-10-03')).toEqual({ kcal: 1800, date: '2026-08-08' })
    expect(recentBmr([e('2026-08-07', { bmrKcal: 1800 })], '2026-10-03')).toBeUndefined()
    expect(computeTargets(goals, [e('2026-08-07', { bmrKcal: 1800 })], '2026-10-03').resting).toEqual({ source: 'formula' })
  })
  it('the newest BMR wins', () => {
    expect(recentBmr([e('2026-09-01', { bmrKcal: 1700 }), e('2026-10-01', { bmrKcal: 1810 }), e('2026-10-02', { weight: 83 })], '2026-10-03')).toEqual({ kcal: 1810, date: '2026-10-01' })
  })
  it('the safety floor still applies', () => {
    const small: Goals = { ...goals, currentStats: { ...goals.currentStats, weight: 50, sex: 'female', activity: 'sitting' } }
    // 900 × 1.53 − 500 = 877 → floor 1200
    expect(computeTargets(small, [e('2026-10-01', { bmrKcal: 900 })], '2026-10-03')).toMatchObject({ kcal: 1200, floorApplied: true, resting: { source: 'bmr', date: '2026-10-01' } })
  })
  it('with a BMR, height and age are not needed; activity and sex still are', () => {
    const noHeight: Goals = { ...goals, currentStats: { weight: 90, weightUnit: 'kg', sex: 'male', activity: 'active' } }
    expect(computeTargets(noHeight, [e('2026-10-01', { bmrKcal: 1800 })], '2026-10-03').kcal).toBe(2670)
    expect(computeTargets(noHeight, [], '2026-10-03').kcal).toBeUndefined()
  })
  it('Meals names which source the target used', async () => {
    const { readFileSync } = await import('node:fs')
    const meals = readFileSync(new URL('../screens/MealsScreen.tsx', import.meta.url), 'utf8')
    expect(meals).toContain('computeTargets(goals, bodyEntries, toISODate(today))')
    expect(meals).toContain('Resting energy from your BMR entry of')
    expect(meals).toContain('Resting energy from your height, age and sex')
  })
})

describe('dates as the v3 frames write them', () => {
  it('"Thu 3 Sep" and "1 Oct"', async () => {
    const { formatDayDate, formatShortDate } = await import('./dates.ts')
    expect(formatDayDate('2026-09-03')).toBe('Thu 3 Sep')
    expect(formatDayDate('2026-10-01')).toBe('Thu 1 Oct')
    expect(formatShortDate('2026-09-14')).toBe('14 Sep')
  })
})
