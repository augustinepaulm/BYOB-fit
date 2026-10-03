// Nutrient targets and limits, exactly as docs/SCORES.md Part 4 (D-079).
// Pure. Limits are shown against the day, never scored (D-079 rule 5).

import type { Goals, MealLabel, ParsedMealLine } from '../types/stores.ts'

/**
 * Fibre target: 14 g per 1,000 kcal of the day's calorie target, to the
 * nearest gram. Without a calorie target, the Adequate Intake by sex and age
 * when both are entered (men 19-50 38 g, 51+ 30 g; women 19-50 25 g, 51+ 21 g).
 * Otherwise none.
 */
export function fibreTarget(kcalTarget: number | undefined, stats: Goals['currentStats'] | undefined): number | undefined {
  if (kcalTarget !== undefined) return Math.round((kcalTarget * 14) / 1000)
  const { sex, age } = stats ?? {}
  if (sex === undefined || age === undefined || age < 19) return undefined
  if (sex === 'male') return age <= 50 ? 38 : 30
  return age <= 50 ? 25 : 21
}

/**
 * The energy band (SCORES.md Part 3): from the larger of target × 0.9 and the
 * safety floor, to target × 1.1. A day below the floor is never in range.
 */
export function energyBand(target: number, floor: number): { low: number; high: number } {
  return { low: Math.max((target * 9) / 10, floor), high: (target * 11) / 10 }
}

export type RangeState = 'below' | 'in' | 'above'

export function rangeOf(kcal: number, band: { low: number; high: number }): RangeState {
  if (kcal < band.low) return 'below'
  if (kcal > band.high) return 'above'
  return 'in'
}

export const SODIUM_LIMIT_MG = 2300
export const SAT_FAT_LIMIT_PCT = 10
export const ADDED_SUGAR_LIMIT_PER_MEAL_G = 10

/** Sodium: under 2,300 mg a day. */
export function sodiumOver(mg: number): boolean {
  return mg >= SODIUM_LIMIT_MG
}

/** Saturated fat as a share of the day's logged calories: g × 9 ÷ kcal, in percent, to one decimal. */
export function satFatPct(satFatG: number, kcal: number): number | undefined {
  if (!(kcal > 0)) return undefined
  return Math.round(((satFatG * 9) / kcal) * 1000) / 10
}

/** No more than 10% of logged calories. */
export function satFatOver(pct: number): boolean {
  return pct > SAT_FAT_LIMIT_PCT
}

export interface SugarByMeal {
  meal: MealLabel
  addedSugarG: number
  over: boolean
}

/**
 * Added sugars (D-079 rule 4): the 10 g limit applies per labelled meal; lines
 * with no meal give a daily total with no limit. Only lines that carry the
 * value count; a meal with none is left out.
 */
export function addedSugars(
  items: ParsedMealLine[],
  mealOf: (item: ParsedMealLine) => MealLabel | null,
): { meals: SugarByMeal[]; unlabelledG?: number } {
  const sums = new Map<MealLabel, number>()
  let unlabelled: number | undefined
  for (const item of items) {
    if (item.addedSugarG === undefined) continue
    const meal = mealOf(item)
    if (meal === null) unlabelled = (unlabelled ?? 0) + item.addedSugarG
    else sums.set(meal, (sums.get(meal) ?? 0) + item.addedSugarG)
  }
  const order: MealLabel[] = ['breakfast', 'lunch', 'dinner', 'snack']
  const meals = order
    .filter((meal) => sums.has(meal))
    .map((meal) => {
      const g = Math.round(sums.get(meal)! * 10) / 10
      return { meal, addedSugarG: g, over: g > ADDED_SUGAR_LIMIT_PER_MEAL_G }
    })
  return unlabelled === undefined ? { meals } : { meals, unlabelledG: Math.round(unlabelled * 10) / 10 }
}

export const MEAL_NAMES: Record<MealLabel, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}
