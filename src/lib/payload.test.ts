import { describe, expect, it } from 'vitest'

import sample from '../../public/sample-program.json'
import type { Program } from '../types/program.ts'
import type { Goals, Session, Settings } from '../types/stores.ts'
import { buildPayload, joinSummary, type PayloadData } from './payload.ts'

const program = { ...(sample as unknown as Program), notes: 'Private program notes' }
const goals: Goals = {
  items: [{ rank: 1, type: 'lose_weight', target: { amount: 10, unit: 'lb' } }, { rank: 2, type: 'get_stronger' }],
  timeframeWeeks: 12,
  startDate: '2026-09-27',
  currentStats: { weight: 82, weightUnit: 'kg', bodyFatPct: 20 },
  updatedAt: '2026-09-27T10:00:00Z',
}
const sessions: Session[] = [
  {
    id: '2026-09-28__mon',
    date: '2026-09-28',
    dayId: 'mon',
    programWeek: 4,
    endedAt: '2026-09-28T10:00:00Z',
    entries: [
      { itemId: 's006', exerciseId: 'bench-press', sets: [{ n: 1, weight: 60, reps: 5 }, { n: 2, raw: 'sore' }], note: 'Shoulder felt tight', feltOff: 'hard' },
      { itemId: 's007', exerciseId: 'incline-db-press', sets: [], feltOff: 'discomfort', skipped: true },
    ],
  },
]
const settings: Settings = {
  apiKey: 'sk-ant-SECRET',
  rules: 'One heavy variable a week.\nNo training to failure.',
  onboarding: { experience: 'new' },
}
// Profile fields exist on the phone but must never be sent.
const data: PayloadData = { program, sessions, goals, rules: settings.rules, settings, week: 4, startedDayIds: ['sun', 'mon'] }
const profileValue = 'Knee surgery 2019'

function keysOf(message: string): string[] {
  return Object.keys(JSON.parse(message)).sort()
}

describe('buildPayload (D-044)', () => {
  it('Minimal: no program notes, no session note, no currentStats, no experience', () => {
    const { message } = buildPayload('update', 'minimal', true, data)
    const sent = JSON.parse(message)
    expect(keysOf(message)).toEqual(['goal', 'logged', 'program', 'rules', 'startedDayIds', 'task', 'week'])
    expect(sent.program.notes).toBeUndefined()
    expect(sent.logged[0].entries[0].note).toBeUndefined()
    expect(message).not.toContain('currentStats')
    expect(message).not.toContain('bodyFatPct')
    // D-048: no felt-off flags at Minimal, anywhere in the message.
    expect(message).not.toContain('feltOff')
    expect(message).not.toContain('discomfort')
    expect(sent.goal).toEqual({ items: goals.items, timeframeWeeks: 12, startDate: '2026-09-27' })
    // Confirmed sets only; the flagged raw row is not sent.
    expect(sent.logged[0].entries[0].sets).toEqual([{ n: 1, weight: 60, reps: 5 }])
  })

  it('Standard adds experience, nothing else', () => {
    const { message, summary } = buildPayload('update', 'standard', true, data)
    expect(keysOf(message)).toEqual(['experience', 'feltOff', 'goal', 'logged', 'program', 'rules', 'startedDayIds', 'task', 'week'])
    expect(JSON.parse(message).experience).toBe('new')
    expect(JSON.parse(message).program.notes).toBeUndefined()
    expect(summary.map((l) => l.label)).toContain('Experience level')
    // D-048: item id and flag only.
    expect(JSON.parse(message).feltOff).toEqual([
      { itemId: 's006', flag: 'hard' },
      { itemId: 's007', flag: 'discomfort' },
    ])
    expect(summary.find((l) => l.label === 'Felt off')?.value).toBe('2')
  })

  it('Full adds current weight; notes only when switched on', () => {
    const off = buildPayload('update', 'full', false, data)
    expect(keysOf(off.message)).toEqual(['currentWeight', 'experience', 'feltOff', 'goal', 'logged', 'program', 'rules', 'startedDayIds', 'task', 'week'])
    expect(JSON.parse(off.message).currentWeight).toEqual({ value: 82, unit: 'kg' })
    expect(JSON.parse(off.message).feltOff).toHaveLength(2)
    expect(off.message).not.toContain('Private program notes')
    expect(off.message).not.toContain('Shoulder felt tight')
    expect(off.message).not.toContain('bodyFatPct')

    const on = buildPayload('update', 'full', true, data)
    expect(JSON.parse(on.message).program.notes).toBe('Private program notes')
    expect(JSON.parse(on.message).logged[0].entries[0].note).toBe('Shoulder felt tight')
  })

  it('Standard ignores the notes switch', () => {
    const { message } = buildPayload('update', 'standard', true, data)
    expect(message).not.toContain('Shoulder felt tight')
  })

  it('never sends Profile fields or the API key, at any level or kind', () => {
    for (const level of ['minimal', 'standard', 'full'] as const) {
      for (const kind of ['review', 'update', 'meals'] as const) {
        const { message } = buildPayload(kind, level, true, { ...data, mealLines: ['DFS'], mealBaseline: 'Oats; chicken.' })
        expect(message).not.toContain('sk-ant-SECRET')
        expect(message).not.toContain('apiKey')
        expect(message).not.toContain(profileValue)
        expect(message).not.toMatch(/"profile"/)
      }
    }
  })

  it('review carries no week or startedDayIds', () => {
    expect(keysOf(buildPayload('review', 'minimal', false, data).message)).toEqual(['goal', 'logged', 'program', 'rules', 'task'])
  })

  it('meals sends the lines and the baseline only', () => {
    const { message, summary } = buildPayload('meals', 'full', true, { ...data, mealLines: ['DFS', 'ADD apple'], mealBaseline: 'Oats\nChicken' })
    expect(JSON.parse(message)).toEqual({ baseline: 'Oats\nChicken', lines: ['DFS', 'ADD apple'] })
    expect(summary).toEqual([
      { label: 'Meal lines', value: '2 lines' },
      { label: 'Your baseline', value: '2 lines' },
    ])
  })

  it('summarises as frames 4h and 4i', () => {
    const { summary } = buildPayload('review', 'standard', false, data)
    expect(summary.slice(0, 4)).toEqual([
      { label: 'Program', value: '4 training days, 35 exercises' },
      { label: 'Logged', value: '1 set from 1 session' },
      { label: 'Goal', value: 'Lose 10 lb in 12 weeks, then get stronger' },
      { label: 'Your training rules', value: '2 lines' },
    ])
    expect(joinSummary(summary)).toContain('Program: 4 training days, 35 exercises · Logged: 1 set from 1 session')
  })
})
