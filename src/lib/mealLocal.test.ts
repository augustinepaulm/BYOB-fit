import { describe, expect, it } from 'vitest'

import type { Goals, MealFood } from '../types/stores.ts'
import { dayTotals, matchLine, parseLocally, sourceOf, waitingLines } from './mealLocal.ts'
import { computeTargets } from './targets.ts'

// Frame 3o's numbers.
const foods: MealFood[] = [
  { name: 'Breakfast', kcal: 480, proteinG: 30 },
  { name: 'lunch', kcal: 770, proteinG: 46 },
  { name: 'Protein bar', kcal: 200, proteinG: 20 },
]

describe('matchLine (D-049 rule 2)', () => {
  it('<food> and BASE <food> count once, case-insensitive, spaces collapsed', () => {
    expect(matchLine('breakfast', foods)).toEqual({ kcal: 480, proteinG: 30 })
    expect(matchLine('  BASE   Lunch ', foods)).toEqual({ kcal: 770, proteinG: 46 })
  })
  it('ADD <food> once, ADD <food> <n> n times, decimals allowed', () => {
    expect(matchLine('ADD protein bar', foods)).toEqual({ kcal: 200, proteinG: 20 })
    expect(matchLine('ADD protein bar 1', foods)).toEqual({ kcal: 200, proteinG: 20 })
    expect(matchLine('add protein bar 2', foods)).toEqual({ kcal: 400, proteinG: 40 })
    expect(matchLine('ADD protein bar 0.5', foods)).toEqual({ kcal: 100, proteinG: 10 })
  })
  it('SKIP <food> subtracts once', () => {
    expect(matchLine('SKIP lunch', foods)).toEqual({ kcal: -770, proteinG: -46 })
  })
  it('an unknown food is unmatched', () => {
    expect(matchLine("Dinner at a friend's, pasta", foods)).toBeNull()
    expect(matchLine('BASE dinner', foods)).toBeNull()
    expect(matchLine('SKIP dinner', foods)).toBeNull()
  })
  it('ADD with a zero, negative or non-numeric count is unmatched', () => {
    expect(matchLine('ADD protein bar 0', foods)).toBeNull()
    expect(matchLine('ADD protein bar -2', foods)).toBeNull()
    expect(matchLine('ADD protein bar two', foods)).toBeNull()
  })
  it('a food whose name ends in a number is matched by its full name first', () => {
    const withTwo = [...foods, { name: 'protein bar 2', kcal: 250, proteinG: 25 }]
    expect(matchLine('ADD protein bar 2', withTwo)).toEqual({ kcal: 250, proteinG: 25 })
    expect(matchLine('protein bar 2', withTwo)).toEqual({ kcal: 250, proteinG: 25 })
    expect(matchLine('ADD protein bar 3', withTwo)).toEqual({ kcal: 600, proteinG: 60 })
  })
  it('a food without protein counts 0 g', () => {
    expect(matchLine('ADD apple 2', [{ name: 'apple', kcal: 95 }])).toEqual({ kcal: 190, proteinG: 0 })
  })
})

describe('parseLocally and totals (frame 3o)', () => {
  const lines = ['BASE breakfast', 'BASE lunch', 'ADD protein bar 1', "Dinner at a friend's, pasta"]
  it('puts matched lines on the phone and the rest under Needs AI', () => {
    const { resolved, waiting } = parseLocally(lines, foods)
    expect(resolved.map((r) => [r.line, r.kcal, r.proteinG, r.source])).toEqual([
      ['BASE breakfast', 480, 30, 'phone'],
      ['BASE lunch', 770, 46, 'phone'],
      ['ADD protein bar 1', 200, 20, 'phone'],
    ])
    expect(waiting).toEqual(["Dinner at a friend's, pasta"])
    // Today excludes the line still waiting.
    expect(dayTotals(resolved)).toEqual({ kcal: 1450, proteinG: 96 })
  })
  it('keeps a manual or AI result for a line it cannot match', () => {
    const manual = { line: "Dinner at a friend's, pasta", kcal: 850, proteinG: 0, source: 'manual' as const }
    const { resolved, waiting } = parseLocally(lines, foods, [manual])
    expect(waiting).toEqual([])
    expect(resolved[3]).toEqual(manual)
    expect(dayTotals(resolved).kcal).toBe(2300)
  })
  it('reads a missing source as ai, and lists waiting lines of a stored day', () => {
    expect(sourceOf({ line: 'x', kcal: 1, proteinG: 1 })).toBe('ai')
    expect(waitingLines({ date: 'd', lines: ['a', 'b'], parsed: { kcal: 1, proteinG: 1, items: [{ line: 'a', kcal: 1, proteinG: 1 }] } })).toEqual(['b'])
  })
})

function goals(main: Goals['items'][number]['type'], stats: Goals['currentStats']): Goals {
  return { items: [{ rank: 1, type: main }], timeframeWeeks: 12, startDate: '2026-09-28', currentStats: stats, updatedAt: '' }
}

describe('computeTargets (D-046, D-049 rule 4)', () => {
  it('male, 40, 180 cm, 90 kg, active, lose weight → 2,720 kcal, 180 g, no floor', () => {
    expect(computeTargets(goals('lose_weight', { weight: 90, weightUnit: 'kg', heightCm: 180, age: 40, sex: 'male', activity: 'active' }))).toEqual({ kcal: 2720, proteinG: 180, floorApplied: false, resting: { source: 'formula' } })
  })
  it('female, 60, 150 cm, 50 kg, sitting, lose weight → 1,200 kcal (floor applied), 100 g', () => {
    expect(computeTargets(goals('lose_weight', { weight: 50, weightUnit: 'kg', heightCm: 150, age: 60, sex: 'female', activity: 'sitting' }))).toEqual({ kcal: 1200, proteinG: 100, floorApplied: true, resting: { source: 'formula' } })
  })
  it('male, 30, 175 cm, 80 kg, active, build muscle → 3,080 kcal, 130 g', () => {
    expect(computeTargets(goals('build_muscle', { weight: 80, weightUnit: 'kg', heightCm: 175, age: 30, sex: 'male', activity: 'active' }))).toEqual({ kcal: 3080, proteinG: 130, floorApplied: false, resting: { source: 'formula' } })
  })
  it('female, 30, 165 cm, 70 kg, very active, lose body fat → 2,700 kcal, 140 g', () => {
    expect(computeTargets(goals('lose_fat', { weight: 70, weightUnit: 'kg', heightCm: 165, age: 30, sex: 'female', activity: 'very_active' }))).toEqual({ kcal: 2700, proteinG: 140, floorApplied: false, resting: { source: 'formula' } })
  })
  it('weight only → protein only; nothing → empty', () => {
    expect(computeTargets(goals('lose_weight', { weight: 90, weightUnit: 'kg' }))).toEqual({ proteinG: 180, floorApplied: false })
    expect(computeTargets(goals('lose_weight', {}))).toEqual({ floorApplied: false })
    expect(computeTargets(null)).toEqual({ floorApplied: false })
  })
  it('converts lb to kg first', () => {
    // 198.416 lb = 90 kg
    expect(computeTargets(goals('lose_weight', { weight: 198.416, weightUnit: 'lb', heightCm: 180, age: 40, sex: 'male', activity: 'active' }))).toEqual({ kcal: 2720, proteinG: 180, floorApplied: false, resting: { source: 'formula' } })
  })
})
