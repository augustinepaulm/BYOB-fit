// Meal parsing (D-006 job 2, EXEC-04 task 6).

import type { MealDay } from '../types/stores.ts'

export interface ParsedLine {
  line: string
  kcal: number
  proteinG: number
}

export interface ParsedMeal {
  kcal: number
  proteinG: number
  items: ParsedLine[]
}

export function mealSystemPrompt(baseline: string): string {
  const described =
    baseline.trim() === ''
      ? 'No baseline has been described. Treat a baseline marker as an unknown and estimate a typical full day.'
      : baseline.trim()
  return `You convert one day of food notes into calories and protein.

The notes use the athlete's own shorthand. A line may be:
- a baseline marker such as DFS, meaning the athlete's default full day, described below,
- SWAP <meal>: <what was eaten instead>,
- ADD <what was eaten on top>,
- SKIP <meal>,
- or a plain description of something eaten.

The athlete's baseline is described here:
${described}

Return ONLY a JSON object, with no prose and no code fence, of exactly this shape:
{ "kcal": number, "proteinG": number, "items": [ { "line": string, "kcal": number, "proteinG": number } ] }

Rules you must follow:
- One entry in "items" per input line, in the same order, with "line" copied exactly as given.
- For a baseline marker, give the whole baseline's kcal and protein.
- For SWAP, ADD and SKIP lines, give the difference from the baseline, which may be negative.
- Top-level "kcal" and "proteinG" are the day's totals: the sum of the items.
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
    })
  }
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    parsed: {
      kcal: parsed.kcal as number,
      proteinG: parsed.proteinG as number,
      items: parsed.items as ParsedLine[],
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
