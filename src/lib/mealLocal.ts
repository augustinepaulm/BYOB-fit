// Meal lines matched on the phone (D-049 rule 2). Pure.

import type { MealDay, MealFood, MealSource, ParsedMealLine } from '../types/stores.ts'

export interface LineTotals {
  kcal: number
  proteinG: number
}

function norm(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function times(food: MealFood, n: number): LineTotals {
  return {
    kcal: Math.round(food.kcal * n * 10) / 10,
    proteinG: Math.round((food.proteinG ?? 0) * n * 10) / 10,
  }
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

/** The day's totals: resolved lines only; lines still waiting are excluded. */
export function dayTotals(items: ParsedMealLine[]): LineTotals {
  return {
    kcal: Math.round(items.reduce((n, i) => n + i.kcal, 0)),
    proteinG: Math.round(items.reduce((n, i) => n + i.proteinG, 0)),
  }
}

/** A saved day as stored: its lines and the results it has so far. */
export function toMealDay(date: string, lines: string[], resolved: ParsedMealLine[], now: Date): MealDay {
  const totals = dayTotals(resolved)
  return { date, lines, parsed: { ...totals, items: resolved }, parsedAt: now.toISOString() }
}

/** The lines of a stored day that have no result yet. */
export function waitingLines(day: MealDay | null | undefined): string[] {
  if (!day) return []
  const done = new Set((day.parsed?.items ?? []).map((i) => i.line))
  return day.parsed ? day.lines.filter((l) => !done.has(l)) : []
}
