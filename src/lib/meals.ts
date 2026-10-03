// Meal parsing (D-006 job 2, EXEC-04 task 6).

import type { MealDay, MealNutrients } from '../types/stores.ts'
import { NUTRIENT_KEYS } from './mealLocal.ts'

export interface ParsedLine extends MealNutrients {
  line: string
  kcal: number
  proteinG: number
}

export interface ParsedMeal extends MealNutrients {
  kcal: number
  proteinG: number
  items: ParsedLine[]
}

/**
 * The meals call's instructions. The user's baseline and lines arrive in the
 * user message (D-044, D-045), so everything of theirs that is sent is in the
 * preview.
 */
export function mealSystemPrompt(): string {
  return `You convert one day of food notes into calories, protein and six more nutrients.

You will be given one JSON message: { "baseline": string, "foods": [ { "name", "kcal", "proteinG"?, "carbsG"?, "fatG"?, "fibreG"?, "sodiumMg"?, "addedSugarG"?, "satFatG"? } ], "lines": string[] }. "lines" are only the lines the phone could not match to the athlete's own foods. "foods" are those foods with their numbers; use them where a line refers to one. "baseline" is the athlete's free-text notes; it may be empty.

The notes use the athlete's own shorthand. A line may be:
- a baseline marker such as DFS, meaning the athlete's default full day (the "baseline"),
- SWAP <meal>: <what was eaten instead>,
- ADD <what was eaten on top>,
- SKIP <meal>,
- or a plain description of something eaten.

Return ONLY a JSON object, with no prose and no code fence, of exactly this shape:
{ "kcal": number, "proteinG": number, "carbsG": number, "fatG": number, "fibreG": number, "sodiumMg": number, "addedSugarG": number, "satFatG": number, "items": [ { "line": string, "kcal": number, "proteinG": number, "carbsG": number, "fatG": number, "fibreG": number, "sodiumMg": number, "addedSugarG": number, "satFatG": number } ] }

Units: kcal in kilocalories; proteinG, carbsG, fatG, fibreG, addedSugarG and satFatG in grams; sodiumMg in milligrams.

Rules you must follow:
- One entry in "items" per input line, in the same order, with "line" copied exactly as given.
- For a baseline marker, give the whole baseline's values.
- For SWAP, ADD and SKIP lines, give the difference from the baseline, which may be negative, for every value.
- Every top-level value is the day's total: the sum of the items.
- Where a quantity is vague, estimate from typical values. Do not ask questions.
- Return the JSON object and nothing else.`
}

export type MealParseResult =
  | { ok: true; parsed: ParsedMeal }
  | { ok: false; errors: string[] }

export function validateParsedMeal(value: unknown): MealParseResult {
  const errors: string[] = []
  const parsed = value as Partial<ParsedMeal>
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, errors: ['/: the response is not a JSON object'] }
  }
  if (typeof parsed.kcal !== 'number' || !Number.isFinite(parsed.kcal)) {
    errors.push('/kcal: must be a number')
  }
  if (typeof parsed.proteinG !== 'number' || !Number.isFinite(parsed.proteinG)) {
    errors.push('/proteinG: must be a number')
  }
  if (!Array.isArray(parsed.items)) {
    errors.push('/items: must be an array')
  } else {
    parsed.items.forEach((item, i) => {
      if (typeof item?.line !== 'string') errors.push(`/items/${i}/line: must be a string`)
      if (typeof item?.kcal !== 'number') errors.push(`/items/${i}/kcal: must be a number`)
      if (typeof item?.proteinG !== 'number') {
        errors.push(`/items/${i}/proteinG: must be a number`)
      }
      // D-079 rule 1: every item carries the six nutrients; differences may be negative.
      for (const key of NUTRIENT_KEYS) {
        const value = (item as Partial<ParsedLine> | undefined)?.[key]
        if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`/items/${i}/${key}: must be a number`)
      }
    })
  }
  for (const key of NUTRIENT_KEYS) {
    const value = parsed[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`/${key}: must be a number`)
  }
  if (errors.length > 0) return { ok: false, errors }
  const pick = (from: Partial<ParsedLine>): MealNutrients => Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, from[key]])) as MealNutrients
  return {
    ok: true,
    parsed: {
      kcal: parsed.kcal as number,
      proteinG: parsed.proteinG as number,
      ...pick(parsed),
      items: (parsed.items as ParsedLine[]).map((item) => ({ line: item.line, kcal: item.kcal, proteinG: item.proteinG, ...pick(item) })),
    },
  }
}

export function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** Totals across the days of a week that have been parsed. */
export function weekTotals(days: MealDay[]): {
  kcal: number
  proteinG: number
  parsedDays: number
} {
  let kcal = 0
  let proteinG = 0
  let parsedDays = 0
  for (const day of days) {
    if (!day.parsed) continue
    kcal += day.parsed.kcal
    proteinG += day.parsed.proteinG
    parsedDays += 1
  }
  return { kcal, proteinG, parsedDays }
}
