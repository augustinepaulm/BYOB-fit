// EXEC-13-rework commit D, task 10 (D-085): usage from replies, cost, the
// month, and the budget gate before every AI action.
import { describe, expect, it } from 'vitest'

import type { SentLogEntry } from '../types/stores.ts'
import { readResponseText, readUsage } from './anthropic.ts'
import {
  DEFAULT_PRICES,
  budgetGate,
  budgetOf,
  budgetState,
  costOf,
  entryCost,
  gateFor,
  monthUsage,
  sameLocalMonth,
} from './usage.ts'

const entry = (at: string, model: string, input: number, output: number, extra: Partial<SentLogEntry> = {}): SentLogEntry => ({
  id: `${at}__review`,
  at,
  kind: 'review',
  privacyLevel: 'minimal',
  payloadSummary: '',
  payload: '',
  status: 'sent',
  model,
  usage: { inputTokens: input, outputTokens: output },
  ...extra,
})

describe('usage from a reply (D-085 rule 1)', () => {
  const reply = { content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 12000, output_tokens: 1500 } }
  it('reads input and output tokens', () => {
    expect(readUsage(reply)).toEqual({ inputTokens: 12000, outputTokens: 1500 })
    expect(readResponseText(reply)).toEqual({ ok: true, text: 'ok', usage: { inputTokens: 12000, outputTokens: 1500 } })
  })
  it('a reply without usage has none', () => {
    expect(readUsage({ content: [] })).toBeUndefined()
    expect(readUsage({ usage: { input_tokens: 'x', output_tokens: 3 } })).toBeUndefined()
    expect(readResponseText({ content: [{ type: 'text', text: 'ok' }] })).toEqual({ ok: true, text: 'ok' })
  })
  it('an unusable reply still carries its usage', () => {
    expect(readResponseText({ content: [], usage: { input_tokens: 10, output_tokens: 0 } })).toEqual({
      ok: false,
      error: 'The model returned no text.',
      usage: { inputTokens: 10, outputTokens: 0 },
    })
  })
})

describe('cost (D-085 rule 3)', () => {
  it('Sonnet 5: 12,000 in and 1,500 out = $0.024 + $0.015 = $0.039', () => {
    const price = DEFAULT_PRICES['claude-sonnet-5']
    expect(price).toEqual({ inputPerM: 2, outputPerM: 10 })
    expect(costOf({ inputTokens: 12000, outputTokens: 0 }, price)).toBeCloseTo(0.024, 10)
    expect(costOf({ inputTokens: 0, outputTokens: 1500 }, price)).toBeCloseTo(0.015, 10)
    expect(costOf({ inputTokens: 12000, outputTokens: 1500 }, price)).toBeCloseTo(0.039, 10)
    expect(entryCost(entry('2026-10-02T10:00:00', 'claude-sonnet-5', 12000, 1500), DEFAULT_PRICES)).toBeCloseTo(0.039, 10)
  })
  it('has the five default rows', () => {
    expect(DEFAULT_PRICES).toEqual({
      'claude-sonnet-5': { inputPerM: 2, outputPerM: 10 },
      'claude-sonnet-5-5': { inputPerM: 2, outputPerM: 10 },
      'claude-haiku-4-5-20251001': { inputPerM: 1, outputPerM: 5 },
      'claude-opus-5-5': { inputPerM: 4, outputPerM: 20 },
      'claude-fable-5-1': { inputPerM: 10, outputPerM: 50 },
    })
  })
  it('a model with no price row shows its tokens and its cost is not counted', () => {
    const now = new Date('2026-10-15T12:00:00')
    const log = [entry('2026-10-02T10:00:00', 'claude-sonnet-5', 12000, 1500), entry('2026-10-03T10:00:00', 'some-new-model', 50000, 5000)]
    expect(entryCost(log[1], DEFAULT_PRICES)).toBeNull()
    const usage = monthUsage(log, DEFAULT_PRICES, now)
    expect(usage.cost).toBeCloseTo(0.039, 10)
    expect(usage.unpriced).toEqual(['some-new-model'])
    expect(usage.perModel.find((r) => r.model === 'some-new-model')).toEqual({ model: 'some-new-model', sends: 1, inputTokens: 50000, outputTokens: 5000, cost: null })
    expect(usage.inputTokens).toBe(62000)
  })
  it('an edited price is used', () => {
    expect(entryCost(entry('2026-10-02T10:00:00', 'claude-sonnet-5', 1_000_000, 0), { 'claude-sonnet-5': { inputPerM: 3, outputPerM: 15 } })).toBe(3)
  })
  it('a call with no usage counts as zero', () => {
    const missing = entry('2026-10-02T10:00:00', 'claude-sonnet-5', 0, 0, { usage: undefined, usageMissing: true })
    expect(entryCost(missing, DEFAULT_PRICES)).toBe(0)
    expect(monthUsage([missing], DEFAULT_PRICES, new Date('2026-10-20T00:00:00')).sends).toBe(1)
  })
  it('a failed call is not counted', () => {
    const failed = entry('2026-10-02T10:00:00', 'claude-sonnet-5', 0, 0, { status: 'failed', usage: undefined })
    expect(monthUsage([failed], DEFAULT_PRICES, new Date('2026-10-20T00:00:00')).sends).toBe(0)
  })
})

describe('the month (D-085 rule 2)', () => {
  it('is the calendar month in local time', () => {
    const now = new Date(2026, 9, 1, 0, 5) // 1 Oct, 00:05 local
    expect(sameLocalMonth(new Date(2026, 8, 30, 23, 59).toISOString(), now)).toBe(false)
    expect(sameLocalMonth(new Date(2026, 9, 1, 0, 0).toISOString(), now)).toBe(true)
    expect(sameLocalMonth(new Date(2025, 9, 15).toISOString(), now)).toBe(false)
  })
  it('counts only this month', () => {
    const log = [
      entry(new Date(2026, 8, 30, 23, 59).toISOString(), 'claude-sonnet-5', 1_000_000, 0),
      entry(new Date(2026, 9, 1, 0, 1).toISOString(), 'claude-sonnet-5', 12000, 1500),
    ]
    const usage = monthUsage(log, DEFAULT_PRICES, new Date(2026, 9, 1, 12))
    expect(usage.sends).toBe(1)
    expect(usage.cost).toBeCloseTo(0.039, 10)
  })
})

describe('budget (D-085 rule 4, task 10c)', () => {
  const budget = { monthlyUsd: 5, warnPct: 80, stopAtBudget: true }
  it('no budget by default; once set, Stop is on and Warn is 80%', () => {
    expect(budgetOf({})).toEqual({ warnPct: 80, stopAtBudget: true })
    expect(budgetState(100, budgetOf({}))).toBe('none')
    expect(budgetOf({ budget: { monthlyUsd: 5, warnPct: 80, stopAtBudget: true } })).toEqual(budget)
  })
  it('warns at 80%', () => {
    expect(budgetState(3.99, budget)).toBe('under')
    expect(budgetState(4.0, budget)).toBe('warn')
    expect(budgetState(4.99, budget)).toBe('warn')
  })
  it('is over at the budget', () => {
    expect(budgetState(5, budget)).toBe('over')
    expect(budgetState(6, budget)).toBe('over')
  })
  it('over with the switch on blocks, with why and how to raise it', () => {
    const gate = budgetGate('over', 5.2, budget)
    expect(gate.kind).toBe('block')
    if (gate.kind === 'block') {
      expect(gate.text).toContain('$5.20 of your $5.00 monthly budget')
      expect(gate.text).toContain('nothing was sent')
      expect(gate.text).toContain('raise the budget')
    }
  })
  it('over with the switch off shows a notice and continues', () => {
    expect(budgetGate('over', 5.2, { ...budget, stopAtBudget: false })).toEqual({ kind: 'notice', text: "Over budget: this month's estimated cost is $5.20 of your $5.00 monthly budget." })
  })
  it('warn shows a notice and continues, with the switch on or off', () => {
    expect(budgetGate('warn', 4.1, budget).kind).toBe('notice')
    expect(budgetGate('warn', 4.1, { ...budget, stopAtBudget: false }).kind).toBe('notice')
  })
  it('under or no budget: nothing in the way', () => {
    expect(budgetGate('under', 1, budget)).toEqual({ kind: 'ok' })
    expect(budgetGate('none', 1, budgetOf({}))).toEqual({ kind: 'ok' })
  })
  it('gateFor reads the whole sent log and settings', () => {
    const now = new Date('2026-10-20T12:00:00')
    // 140 calls at $0.039 = $5.46
    const log = Array.from({ length: 140 }, (_, i) => entry(new Date(2026, 9, 2, 10, i).toISOString(), 'claude-sonnet-5', 12000, 1500))
    expect(gateFor(log, { budget }, now).kind).toBe('block')
    expect(gateFor(log, { budget: { ...budget, stopAtBudget: false } }, now).kind).toBe('notice')
    expect(gateFor(log, { budget: { ...budget, monthlyUsd: 10 } }, now)).toEqual({ kind: 'ok' })
    expect(gateFor(log, {}, now)).toEqual({ kind: 'ok' })
  })
  it('every AI action goes through the gate before its preview', async () => {
    const { readFileSync } = await import('node:fs')
    const hook = readFileSync(new URL('../ai/usePreview.tsx', import.meta.url), 'utf8')
    const open = hook.slice(hook.indexOf('open: () => {'))
    expect(open).toContain('gateFor(log, settings, new Date())')
    expect(open.indexOf("if (next.kind === 'block') return")).toBeLessThan(open.indexOf('setShowing(true)'))
    for (const screen of ['ReviewScreen', 'BuildScreen', 'MealsScreen']) {
      const source = readFileSync(new URL(`../screens/${screen}.tsx`, import.meta.url), 'utf8')
      // The send happens only from the preview's onSend, and the buttons only open the preview.
      expect(source, screen).toContain('usePreview({')
      expect(source, screen).toMatch(/onSend: \(payload, level\) => void send(Lines)?\(payload, level\)/)
      expect(source, screen).toContain('preview.open()')
    }
  })
})
