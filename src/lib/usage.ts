// AI usage and budget (D-070 as amended by D-085). Pure: the sent log, the
// price table and the budget in; this month's tokens, estimated cost and
// budget state out. Every cost is an estimate.

import type { Budget, ModelPrice, SentLogEntry, Settings } from '../types/stores.ts'

/**
 * D-085 rule 3: per million tokens in and out, verified Oct 3, 2026 at
 * platform.claude.com/docs/en/about-claude/pricing. Every row is editable.
 */
export const DEFAULT_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-5': { inputPerM: 2, outputPerM: 10 },
  'claude-sonnet-5-5': { inputPerM: 2, outputPerM: 10 },
  'claude-haiku-4-5-20251001': { inputPerM: 1, outputPerM: 5 },
  'claude-opus-5-5': { inputPerM: 4, outputPerM: 20 },
  'claude-fable-5-1': { inputPerM: 10, outputPerM: 50 },
}

/** Display names for the default rows. */
export const MODEL_NAMES: Record<string, string> = {
  'claude-sonnet-5': 'Sonnet 5',
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-opus-5-5': 'Opus 5.5',
  'claude-fable-5-1': 'Fable 5.1',
}

export const DEFAULT_WARN_PCT = 80

/** D-085 rule 5: the console's limits page. */
export const CONSOLE_LIMITS_URL = 'https://platform.claude.com/settings/limits'

export function pricesOf(settings: Settings | null | undefined): Record<string, ModelPrice> {
  return settings?.prices ?? DEFAULT_PRICES
}

/** D-085 rule 4: none by default; once a budget is set, Stop is on and Warn is 80%. */
export function budgetOf(settings: Settings | null | undefined): Budget {
  return { warnPct: DEFAULT_WARN_PCT, stopAtBudget: true, ...settings?.budget }
}

/** Dollars for a number of tokens at a price. */
export function costOf(usage: { inputTokens: number; outputTokens: number }, price: ModelPrice): number {
  return (usage.inputTokens * price.inputPerM + usage.outputTokens * price.outputPerM) / 1_000_000
}

/** One entry's estimated cost; null when its model has no price row. A call with no usage costs zero. */
export function entryCost(entry: SentLogEntry, prices: Record<string, ModelPrice>): number | null {
  const price = prices[entry.model ?? '']
  if (!price) return entry.usage ? null : 0
  return entry.usage ? costOf(entry.usage, price) : 0
}

/** D-085 rule 2: the calendar month in the phone's local time. */
export function sameLocalMonth(at: string, now: Date): boolean {
  const date = new Date(at)
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export interface ModelUsage {
  model: string
  sends: number
  inputTokens: number
  outputTokens: number
  /** Null when the model has no price row: tokens shown, cost not counted. */
  cost: number | null
}

export interface MonthUsage {
  sends: number
  inputTokens: number
  outputTokens: number
  /** Estimated dollars over the priced models only. */
  cost: number
  perModel: ModelUsage[]
  /** Models used this month with no price row (D-085 rule 3: "No price set"). */
  unpriced: string[]
}

/** This month's sends, tokens and estimated cost, per model and in total. */
export function monthUsage(log: SentLogEntry[], prices: Record<string, ModelPrice>, now: Date): MonthUsage {
  const byModel = new Map<string, ModelUsage>()
  for (const entry of log) {
    if (!sameLocalMonth(entry.at, now)) continue
    // A call that never reached the API cost nothing and is not a send.
    if (entry.status === 'failed') continue
    const model = entry.model ?? ''
    const row = byModel.get(model) ?? { model, sends: 0, inputTokens: 0, outputTokens: 0, cost: prices[model] ? 0 : null }
    row.sends += 1
    row.inputTokens += entry.usage?.inputTokens ?? 0
    row.outputTokens += entry.usage?.outputTokens ?? 0
    if (row.cost !== null) row.cost = costOf(row, prices[model])
    byModel.set(model, row)
  }
  const perModel = [...byModel.values()]
  return {
    sends: perModel.reduce((n, r) => n + r.sends, 0),
    inputTokens: perModel.reduce((n, r) => n + r.inputTokens, 0),
    outputTokens: perModel.reduce((n, r) => n + r.outputTokens, 0),
    cost: perModel.reduce((n, r) => n + (r.cost ?? 0), 0),
    perModel,
    unpriced: perModel.filter((r) => r.cost === null && (r.inputTokens > 0 || r.outputTokens > 0)).map((r) => r.model),
  }
}

export type BudgetState = 'none' | 'under' | 'warn' | 'over'

/** Under, warn (at or past the warn share) or over (at or past the budget). */
export function budgetState(cost: number, budget: Budget): BudgetState {
  const limit = budget.monthlyUsd
  if (limit === undefined || !(limit > 0)) return 'none'
  if (cost >= limit) return 'over'
  if (cost >= (limit * budget.warnPct) / 100) return 'warn'
  return 'under'
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export type BudgetGate = { kind: 'ok' } | { kind: 'notice'; text: string } | { kind: 'block'; title: string; text: string }

/**
 * D-085 rule 4, task 10c: checked before the send preview opens. Over with
 * Stop on sends nothing and says why and how to raise it; warn, and over with
 * Stop off, show a notice and continue.
 */
export function budgetGate(state: BudgetState, cost: number, budget: Budget): BudgetGate {
  const limit = budget.monthlyUsd ?? 0
  const spent = `${formatUsd(cost)} of your ${formatUsd(limit)} monthly budget`
  if (state === 'over' && budget.stopAtBudget) {
    return {
      kind: 'block',
      title: 'Monthly AI budget reached',
      text: `This month's estimated cost is ${spent}, so nothing was sent. To send anyway, raise the budget or turn off Stop sending at the budget in Settings, AI usage and budget.`,
    }
  }
  if (state === 'over') return { kind: 'notice', text: `Over budget: this month's estimated cost is ${spent}.` }
  if (state === 'warn') return { kind: 'notice', text: `This month's estimated cost is ${spent}.` }
  return { kind: 'ok' }
}

/** The whole check from stored data, for the AI screens. */
export function gateFor(log: SentLogEntry[], settings: Settings | null | undefined, now: Date): BudgetGate {
  const budget = budgetOf(settings)
  const usage = monthUsage(log, pricesOf(settings), now)
  return budgetGate(budgetState(usage.cost, budget), usage.cost, budget)
}
