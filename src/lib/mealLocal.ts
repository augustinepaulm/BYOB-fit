// Meal lines matched on the phone (D-049 rule 2). Pure.

import type { MealDay, MealFood, MealLabel, MealNutrients, MealSource, ParsedMealLine } from '../types/stores.ts'

/** D-079 rule 1: the nutrients beyond calories and protein. */
export const NUTRIENT_KEYS = ['carbsG', 'fatG', 'fibreG', 'sodiumMg', 'addedSugarG', 'satFatG'] as const satisfies readonly (keyof MealNutrients)[]

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

export interface LineTotals extends MealNutrients {
  kcal: number
  proteinG: number
}

function norm(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

const round1 = (v: number) => Math.round(v * 10) / 10

/** A food counted n times; its optional nutrients come along (D-079 rule 1: counted on the phone). */
function times(food: MealFood, n: number): LineTotals {
  const totals: LineTotals = {
    kcal: round1(food.kcal * n),
    proteinG: round1((food.proteinG ?? 0) * n),
  }
  for (const key of NUTRIENT_KEYS) {
    const value = food[key]
    if (value !== undefined) totals[key] = round1(value * n)
  }
  return totals
}

/** The saved food a line names, for the friendly list (3.02): exact name, BASE, ADD or SKIP. */
export function foodForLine(line: string, foods: MealFood[]): MealFood | undefined {
  const byName = new Map(foods.map((f) => [norm(f.name), f]))
  const text = norm(line)
  const direct = byName.get(text)
  if (direct) return direct
  const rest = text.replace(/^(base|add|skip) /, '')
  return byName.get(rest) ?? byName.get(rest.replace(/ \d*\.?\d+$/, ''))
}

/**
 * `<food>` and `BASE <food>` count once; `ADD <food>` once and `ADD <food> <n>`
 * n times (n > 0, decimals allowed); `SKIP <food>` subtracts once. A food's
 * full name is tried before reading a trailing number as a count.
 */
export function matchLine(line: string, foods: MealFood[]): LineTotals | null {
  const byName = new Map(foods.map((f) => [norm(f.name), f]))
  const text = norm(line)
  if (text === '') return null
  const exact = byName.get(text)
  if (exact) return times(exact, 1)

  const space = text.indexOf(' ')
  if (space < 0) return null
  const verb = text.slice(0, space)
  const rest = text.slice(space + 1)

  if (verb === 'base') {
    const food = byName.get(rest)
    return food ? times(food, 1) : null
  }
  if (verb === 'skip') {
    const food = byName.get(rest)
    return food ? times(food, -1) : null
  }
  if (verb === 'add') {
    const whole = byName.get(rest)
    if (whole) return times(whole, 1)
    const last = rest.lastIndexOf(' ')
    if (last < 0) return null
    const food = byName.get(rest.slice(0, last))
    const countText = rest.slice(last + 1)
    if (!food || !/^\d*\.?\d+$/.test(countText)) return null
    const n = Number(countText)
    return n > 0 ? times(food, n) : null
  }
  return null
}

/** A missing source reads as 'ai' (lines parsed before D-049). */
export function sourceOf(item: ParsedMealLine): MealSource {
  return item.source ?? 'ai'
}

export interface SplitDay {
  /** Lines with a stored result, in line order. */
  resolved: ParsedMealLine[]
  /** Lines with no result yet: Needs AI. */
  waiting: string[]
}

/**
 * Parse on the phone: every line either matches a food now, keeps a result it
 * already has (ai or manual), or waits under Needs AI.
 */
export function parseLocally(lines: string[], foods: MealFood[], previous: ParsedMealLine[] = []): SplitDay {
  const resolved: ParsedMealLine[] = []
  const waiting: string[] = []
  for (const line of lines) {
    const match = matchLine(line, foods)
    if (match) {
      resolved.push({ line, ...match, source: 'phone' })
      continue
    }
    const kept = previous.find((p) => p.line === line && sourceOf(p) !== 'phone')
    if (kept) resolved.push(kept)
    else waiting.push(line)
  }
  return { resolved, waiting }
}

/**
 * The day's totals: resolved lines only; lines still waiting are excluded.
 * A nutrient is totalled over the lines that carry it, and is absent when
 * no line does (differences may be negative, as for kcal).
 */
export function dayTotals(items: ParsedMealLine[]): LineTotals {
  const totals: LineTotals = {
    kcal: Math.round(items.reduce((n, i) => n + i.kcal, 0)),
    proteinG: Math.round(items.reduce((n, i) => n + i.proteinG, 0)),
  }
  for (const key of NUTRIENT_KEYS) {
    const carrying = items.filter((i) => i[key] !== undefined)
    if (carrying.length === 0) continue
    // Sodium in whole milligrams; grams to one decimal.
    const sum = carrying.reduce((n, i) => n + (i[key] as number), 0)
    totals[key] = key === 'sodiumMg' ? Math.round(sum) : round1(sum)
  }
  return totals
}

/** D-079 rule 1: whether any line behind a value came from the AI, so it is marked "AI estimate". */
export function aiEstimated(items: ParsedMealLine[], key: NutrientKey | 'kcal' | 'proteinG'): boolean {
  return items.some((i) => sourceOf(i) === 'ai' && i[key] !== undefined)
}

/** A saved day as stored: its lines, their meal labels and the results it has so far. */
export function toMealDay(date: string, lines: string[], resolved: ParsedMealLine[], now: Date, lineMeals?: (MealLabel | null)[]): MealDay {
  const totals = dayTotals(resolved)
  const day: MealDay = { date, lines, parsed: { ...totals, items: resolved }, parsedAt: now.toISOString() }
  if (lineMeals && lineMeals.some((m) => m !== null)) day.lineMeals = lines.map((_, i) => lineMeals[i] ?? null)
  return day
}

/** D-079 rule 4: each line's meal, null when unlabelled (days before Phase 13 have none). */
export function mealOfLine(day: Pick<MealDay, 'lines' | 'lineMeals'>, index: number): MealLabel | null {
  return day.lineMeals?.[index] ?? null
}

/** The lines of a stored day that have no result yet. */
export function waitingLines(day: MealDay | null | undefined): string[] {
  if (!day) return []
  const done = new Set((day.parsed?.items ?? []).map((i) => i.line))
  return day.parsed ? day.lines.filter((l) => !done.has(l)) : []
}
