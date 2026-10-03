// EXEC-13-rework commit F, task 12 (D-079, docs/SCORES.md Part 4).
import { describe, expect, it } from 'vitest'

import type { MealLabel, ParsedMealLine } from '../types/stores.ts'
import { aiEstimated, dayTotals, matchLine, parseLocally, toMealDay } from './mealLocal.ts'
import { validateParsedMeal } from './meals.ts'
import { addedSugars, energyBand, fibreTarget, rangeOf, satFatOver, satFatPct, sodiumOver } from './nutrients.ts'
import { buildPayload } from './payload.ts'

describe('SCORES.md Part 4 worked examples', () => {
  it('fibre target at 2,720 kcal: 2,720 × 14 ÷ 1,000 = 38.08, shown as 38 g', () => {
    expect(fibreTarget(2720, undefined)).toBe(38)
  })
  it('2,400 kcal with 30 g saturated fat: 30 × 9 ÷ 2,400 = 11.3%, over the 10% limit', () => {
    expect(satFatPct(30, 2400)).toBe(11.3)
    expect(satFatOver(11.3)).toBe(true)
    expect(satFatOver(10)).toBe(false)
  })
})

describe('fibre target without a calorie target', () => {
  it.each([
    [{ sex: 'male' as const, age: 40 }, 38],
    [{ sex: 'male' as const, age: 51 }, 30],
    [{ sex: 'female' as const, age: 50 }, 25],
    [{ sex: 'female' as const, age: 60 }, 21],
  ])('%o: %i g', (stats, grams) => {
    expect(fibreTarget(undefined, stats)).toBe(grams)
  })
  it('none without both sex and age', () => {
    expect(fibreTarget(undefined, { sex: 'male' })).toBeUndefined()
    expect(fibreTarget(undefined, { age: 30 })).toBeUndefined()
    expect(fibreTarget(undefined, undefined)).toBeUndefined()
  })
})

describe('energy band and limits', () => {
  it('target ±10%, never starting below the floor', () => {
    expect(energyBand(2400, 1500)).toEqual({ low: 2160, high: 2640 })
    expect(energyBand(1600, 1500)).toEqual({ low: 1500, high: 1760 })
    expect(rangeOf(1850, energyBand(2400, 1500))).toBe('below')
    expect(rangeOf(2200, energyBand(2400, 1500))).toBe('in')
    expect(rangeOf(2700, energyBand(2400, 1500))).toBe('above')
  })
  it('a day below the floor is never in range', () => {
    expect(rangeOf(1450, energyBand(1500, 1500))).toBe('below')
  })
  it('sodium: under 2,300 mg', () => {
    expect(sodiumOver(2299)).toBe(false)
    expect(sodiumOver(2300)).toBe(true)
  })
})

describe('added sugars per labelled meal only (D-079 rule 4)', () => {
  const items: ParsedMealLine[] = [
    { line: 'oats', kcal: 300, proteinG: 10, addedSugarG: 4 },
    { line: 'yoghurt', kcal: 150, proteinG: 8, addedSugarG: 8 },
    { line: 'wrap', kcal: 610, proteinG: 38, addedSugarG: 9 },
    { line: 'cola', kcal: 140, proteinG: 0, addedSugarG: 35 },
    { line: 'apple', kcal: 95, proteinG: 0 },
  ]
  const meals: Record<string, MealLabel | null> = { oats: 'breakfast', yoghurt: 'breakfast', wrap: 'lunch', cola: null, apple: 'lunch' }
  const result = addedSugars(items, (i) => meals[i.line])
  it('sums each meal and checks it against 10 g', () => {
    expect(result.meals).toEqual([
      { meal: 'breakfast', addedSugarG: 12, over: true },
      { meal: 'lunch', addedSugarG: 9, over: false },
    ])
  })
  it('unlabelled lines give a daily total with no limit', () => {
    expect(result.unlabelledG).toBe(35)
  })
  it('a day with no labels has no per-meal limit', () => {
    expect(addedSugars(items, () => null)).toEqual({ meals: [], unlabelledG: 56 })
  })
  it('meal labels are stored per line and kept', () => {
    const day = toMealDay('2026-10-03', ['oats', 'cola'], [], new Date('2026-10-03T08:00:00Z'), ['breakfast', null])
    expect(day.lineMeals).toEqual(['breakfast', null])
    expect(toMealDay('2026-10-03', ['oats'], [], new Date(), [null]).lineMeals).toBeUndefined()
  })
})

describe('validateParsedMeal with the new fields (D-079 rule 1)', () => {
  const item = { line: 'Chicken wrap', kcal: 610, proteinG: 38, carbsG: 60, fatG: 20, fibreG: 6, sodiumMg: 1200, addedSugarG: 7, satFatG: 9 }
  const reply = { kcal: 610, proteinG: 38, carbsG: 60, fatG: 20, fibreG: 6, sodiumMg: 1200, addedSugarG: 7, satFatG: 9, items: [item] }
  it('accepts a full reply and keeps every field', () => {
    expect(validateParsedMeal(reply)).toEqual({ ok: true, parsed: reply })
  })
  it('differences may be negative', () => {
    const skip = { ...item, line: 'SKIP lunch', kcal: -500, carbsG: -40, sodiumMg: -800 }
    expect(validateParsedMeal({ ...reply, kcal: -500, carbsG: -40, sodiumMg: -800, items: [skip] }).ok).toBe(true)
  })
  for (const key of ['carbsG', 'fatG', 'fibreG', 'sodiumMg', 'addedSugarG', 'satFatG'] as const) {
    it(`refuses an item without ${key}`, () => {
      const without: Record<string, unknown> = { ...item }
      delete without[key]
      const result = validateParsedMeal({ ...reply, items: [without] })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors).toEqual([`/items/0/${key}: must be a number`])
    })
    it(`refuses a day total ${key} that is not a number`, () => {
      const result = validateParsedMeal({ ...reply, [key]: 'six' })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors).toEqual([`/${key}: must be a number`])
    })
  }
  it('drops anything else the model adds', () => {
    const result = validateParsedMeal({ ...reply, note: 'x', items: [{ ...item, brand: 'y' }] })
    expect(result.ok && result.parsed.items[0]).toEqual(item)
  })
})

describe('baseline foods count on the phone (D-079 rule 1)', () => {
  const foods = [
    { name: 'usual breakfast', kcal: 520, proteinG: 24, carbsG: 80, fatG: 12, fibreG: 9, sodiumMg: 300, addedSugarG: 4, satFatG: 4 },
    { name: 'shake', kcal: 125, proteinG: 25 },
  ]
  it('a food’s fields come with it, times the count', () => {
    expect(matchLine('ADD usual breakfast 2', foods)).toEqual({ kcal: 1040, proteinG: 48, carbsG: 160, fatG: 24, fibreG: 18, sodiumMg: 600, addedSugarG: 8, satFatG: 8 })
    expect(matchLine('SKIP usual breakfast', foods)?.fibreG).toBe(-9)
  })
  it('totals carry a nutrient only where a line has it; no AI involved', () => {
    const { resolved, waiting } = parseLocally(['usual breakfast', 'shake'], foods)
    expect(waiting).toEqual([])
    expect(resolved.every((r) => r.source === 'phone')).toBe(true)
    expect(dayTotals(resolved)).toEqual({ kcal: 645, proteinG: 49, carbsG: 80, fatG: 12, fibreG: 9, sodiumMg: 300, addedSugarG: 4, satFatG: 4 })
    expect(aiEstimated(resolved, 'fibreG')).toBe(false)
  })
  it('AI values are marked as estimates', () => {
    const items: ParsedMealLine[] = [{ line: 'wrap', kcal: 610, proteinG: 38, fibreG: 6, source: 'ai' }, { line: 'x', kcal: 1, proteinG: 1, source: 'phone' }]
    expect(aiEstimated(items, 'fibreG')).toBe(true)
    expect(aiEstimated(items, 'sodiumMg')).toBe(false)
  })
  it('the meals estimate sends a food’s own values with it', () => {
    const sent = JSON.parse(buildPayload('meals', 'minimal', false, { mealLines: ['wrap'], mealFoods: foods }).message)
    expect(sent.foods).toEqual(foods)
  })
  it('the old line grammar still parses (D-049)', () => {
    const { resolved, waiting } = parseLocally(['BASE usual breakfast', 'ADD shake 2', 'skip shake', 'pizza'], foods)
    expect(resolved.map((r) => r.kcal)).toEqual([520, 250, -125])
    expect(waiting).toEqual(['pizza'])
  })
})
