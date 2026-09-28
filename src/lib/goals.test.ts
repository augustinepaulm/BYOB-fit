import { describe, expect, it } from 'vitest'

import {
  fromGoals,
  goalDetail,
  goalSummary,
  goalsValid,
  moveGoal,
  timeframeEnd,
  timeframeLine,
  toGoals,
  toggleGoal,
  type GoalDraft,
} from './goals.ts'

const bench = (id: string) => (id === 'bb-bench' ? 'Barbell bench press' : undefined)
const lose10lb: GoalDraft = { type: 'lose_weight', amount: 10, unit: 'lb' }

describe('goalSummary (frame 1h)', () => {
  it('reads one goal', () => {
    expect(goalSummary([lose10lb], 12)).toBe('Lose 10 lb in 12 weeks.')
  })
  it('reads two goals exactly as the frame', () => {
    expect(
      goalSummary([lose10lb, { type: 'get_stronger', amount: 10, unit: 'lb', exerciseId: 'bb-bench' }], 12, bench),
    ).toBe('Lose 10 lb in 12 weeks, then get stronger.')
  })
  it('reads three goals', () => {
    expect(
      goalSummary([lose10lb, { type: 'get_stronger' }, { type: 'improve_cardio' }], 8),
    ).toBe('Lose 10 lb in 8 weeks, then get stronger and improve cardio.')
  })
  it('puts a strength target first when it is the main goal', () => {
    expect(
      goalSummary([{ type: 'get_stronger', amount: 5, unit: 'kg', exerciseId: 'bb-bench' }], 4, bench),
    ).toBe('Add 5 kg to barbell bench press in 4 weeks.')
  })
  it('uses the plain goal when the main goal takes no number', () => {
    expect(goalSummary([{ type: 'build_muscle' }, { type: 'general' }], 16)).toBe(
      'Build muscle in 16 weeks, then improve general fitness.',
    )
  })
})

describe('goalDetail (frame 1h sub-lines)', () => {
  it('matches the frame', () => {
    expect(goalDetail(lose10lb)).toBe('Lose 10 lb')
    expect(goalDetail({ type: 'get_stronger', amount: 10, unit: 'lb' }, 'Barbell bench press')).toBe(
      'Add 10 lb to barbell bench press',
    )
    expect(goalDetail({ type: 'lose_fat', amount: 5 })).toBe('Lose 5% body fat')
    expect(goalDetail({ type: 'improve_cardio' })).toBeNull()
  })
})

describe('timeframe', () => {
  it('ends whole weeks after the start', () => {
    const end = timeframeEnd(new Date(2026, 8, 27), 12)
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 11, 20])
  })
  it('reads as in frame 1g', () => {
    expect(timeframeLine(new Date(2026, 8, 27), 12)).toBe('12 weeks, ending Dec 20')
  })
})

describe('goal limits (D-030)', () => {
  it('needs exactly one main goal', () => {
    expect(goalsValid([])).toBe(false)
    expect(goalsValid([lose10lb])).toBe(true)
  })
  it('allows at most three', () => {
    let goals: GoalDraft[] = []
    for (const type of ['lose_weight', 'get_stronger', 'improve_cardio', 'general'] as const) {
      goals = toggleGoal(goals, type, 'kg')
    }
    expect(goals.map((g) => g.type)).toEqual(['lose_weight', 'get_stronger', 'improve_cardio'])
    expect(goalsValid(goals)).toBe(true)
    expect(goalsValid([...goals, { type: 'general' }])).toBe(false)
  })
  it('removes a goal when it is tapped again', () => {
    expect(toggleGoal([lose10lb], 'lose_weight', 'kg')).toEqual([])
  })
  it('rejects the same goal twice', () => {
    expect(goalsValid([lose10lb, lose10lb])).toBe(false)
  })
})

describe('ordering and storage', () => {
  it('moves a goal up and down', () => {
    const goals: GoalDraft[] = [{ type: 'lose_weight' }, { type: 'get_stronger' }, { type: 'general' }]
    expect(moveGoal(goals, 2, 1).map((g) => g.type)).toEqual(['lose_weight', 'general', 'get_stronger'])
    expect(moveGoal(goals, 0, -1)).toBe(goals)
  })
  it('stores ranks from list order and reads them back', () => {
    const drafts: GoalDraft[] = [
      lose10lb,
      { type: 'lose_fat', amount: 4 },
      { type: 'get_stronger', amount: 10, unit: 'lb', exerciseId: 'bb-bench' },
    ]
    const stored = toGoals(drafts, {
      timeframeWeeks: 12,
      startDate: '2026-09-28',
      now: new Date('2026-09-28T09:00:00Z'),
    })
    expect(stored.items).toEqual([
      { rank: 1, type: 'lose_weight', target: { amount: 10, unit: 'lb' } },
      { rank: 2, type: 'lose_fat', target: { amount: 4, unit: 'percent' } },
      { rank: 3, type: 'get_stronger', target: { amount: 10, unit: 'lb', exerciseId: 'bb-bench' } },
    ])
    expect(fromGoals(stored)).toEqual(drafts)
  })
})
