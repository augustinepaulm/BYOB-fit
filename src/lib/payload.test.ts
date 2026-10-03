import { describe, expect, it } from 'vitest'

import sample from '../../public/sample-program.json'
import type { Program } from '../types/program.ts'
import type { BodyEntry, Goals, Session, Settings } from '../types/stores.ts'
import { PRIVACY_LEVELS, buildPayload, joinSummary, type PayloadData, type WeekReviewData } from './payload.ts'

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

const bodyEntries: BodyEntry[] = [
  { date: '2026-10-01', units: 'kg', weight: 83, skeletalMuscle: 34.2, bodyFatMass: 18.6, bodyFatPct: 22.4, visceralFat: 8, bmrKcal: 1810, waist: 88, chest: 104, hips: 99, upperArm: 35, thigh: 58, updatedAt: '2026-10-01T07:00:00Z' },
  { date: '2026-09-03', units: 'kg', weight: 84.1, updatedAt: '2026-09-03T07:00:00Z' },
]
const weekReview: WeekReviewData = {
  view: 'training',
  weekStart: '2026-09-27',
  programWeek: 5,
  score: 76,
  parts: [
    { label: 'Adherence', value: '4 of 5 workouts done', weight: 40 },
    { label: 'Completeness', value: '60 of 68 sets', weight: 30 },
    { label: 'Progression', value: '3 up, 6 same, 1 down', weight: 30 },
  ],
  data: { finished: 4, planned: 5 },
}

function keysOf(message: string): string[] {
  return Object.keys(JSON.parse(message)).sort()
}

describe('buildPayload (D-044)', () => {
  it('Minimal: no program notes, no session note, no currentStats, no experience', () => {
    const { message } = buildPayload('update', 'minimal', true, data)
    const sent = JSON.parse(message)
    expect(keysOf(message)).toEqual(['bodyEntries', 'goal', 'logged', 'program', 'rules', 'startedDayIds', 'task', 'week'])
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
    expect(keysOf(message)).toEqual(['bodyEntries', 'experience', 'feltOff', 'goal', 'logged', 'program', 'rules', 'startedDayIds', 'task', 'week'])
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
    expect(keysOf(off.message)).toEqual(['bodyEntries', 'currentWeight', 'experience', 'feltOff', 'goal', 'logged', 'program', 'rules', 'startedDayIds', 'task', 'week'])
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
      for (const kind of ['review', 'update', 'meals', 'week_note'] as const) {
        const { message } = buildPayload(kind, level, true, { ...data, mealLines: ['DFS'], mealBaseline: 'Oats; chicken.' })
        expect(message).not.toContain('sk-ant-SECRET')
        expect(message).not.toContain('apiKey')
        expect(message).not.toContain(profileValue)
        expect(message).not.toMatch(/"profile"/)
      }
    }
  })

  it('review carries no week or startedDayIds', () => {
    expect(keysOf(buildPayload('review', 'minimal', false, data).message)).toEqual(['bodyEntries', 'goal', 'logged', 'program', 'rules', 'task'])
  })

  it('meals sends the lines and the baseline only', () => {
    const { message, summary } = buildPayload('meals', 'full', true, {
      ...data,
      mealLines: ["Dinner at a friend's, pasta"],
      mealFoods: [{ name: 'breakfast', kcal: 480, proteinG: 30 }, { name: 'apple', kcal: 95 }],
      mealBaseline: 'Oats\nChicken',
    })
    // D-049 rule 3: only the unmatched lines, the foods and the notes.
    expect(JSON.parse(message)).toEqual({
      baseline: 'Oats\nChicken',
      foods: [{ name: 'breakfast', kcal: 480, proteinG: 30 }, { name: 'apple', kcal: 95 }],
      lines: ["Dinner at a friend's, pasta"],
    })
    expect(summary).toEqual([
      { label: 'Meal lines', value: '1 line' },
      { label: 'Your foods', value: '2 foods' },
      { label: 'Notes', value: '2 lines' },
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

  it('never sends height, age, sex or activity, at any level or kind (D-046)', () => {
    const withBody = {
      ...data,
      goals: { ...goals, currentStats: { weight: 82, weightUnit: 'kg' as const, heightCm: 180, age: 40, sex: 'male' as const, activity: 'active' as const } },
      mealLines: ['x'],
      bodyEntries,
      weekReview,
    }
    for (const level of ['minimal', 'standard', 'full'] as const) {
      for (const kind of ['review', 'update', 'meals', 'week_note'] as const) {
        for (const notes of [false, true]) {
          const { message } = buildPayload(kind, level, notes, withBody)
          for (const key of ['heightCm', 'age', 'sex', 'activity', 'apiKey']) {
            expect(message).not.toContain(`"${key}"`)
          }
          expect(message).not.toContain('sk-ant-SECRET')
        }
      }
    }
  })
})

describe('body entries and week scores at every level (D-084 rule 2, task 10e)', () => {
  const withBody: PayloadData = { ...data, bodyEntries, weekReview }
  for (const level of ['minimal', 'standard', 'full'] as const) {
    for (const kind of ['review', 'update', 'week_note'] as const) {
      it(`${kind} at ${level} sends every body entry with all its fields and dates`, () => {
        const sent = JSON.parse(buildPayload(kind, level, false, withBody).message)
        expect(sent.bodyEntries).toEqual([
          { date: '2026-09-03', units: 'kg', weight: 84.1 },
          { date: '2026-10-01', units: 'kg', weight: 83, skeletalMuscle: 34.2, bodyFatMass: 18.6, bodyFatPct: 22.4, visceralFat: 8, bmrKcal: 1810, waist: 88, chest: 104, hips: 99, upperArm: 35, thigh: 58 },
        ])
      })
    }
    it(`week_note at ${level} sends the week's score and its parts`, () => {
      const { message, summary } = buildPayload('week_note', level, false, withBody)
      const sent = JSON.parse(message)
      expect(sent.task).toBe('week_note')
      expect(sent.view).toBe('training')
      expect(sent.weekStart).toBe('2026-09-27')
      expect(sent.score).toBe(76)
      expect(sent.parts).toEqual(weekReview.parts)
      expect(sent.weekData).toEqual({ finished: 4, planned: 5 })
      expect(summary[1]).toEqual({ label: 'Score', value: '76 and its 3 parts' })
    })
  }

  it('the summary names the body entries', () => {
    const { summary } = buildPayload('review', 'minimal', false, withBody)
    expect(summary.find((l) => l.label === 'Body entries')?.value).toBe('2 entries')
    expect(buildPayload('review', 'minimal', false, data).summary.find((l) => l.label === 'Body entries')?.value).toBe('None')
  })

  it('the meals estimate still sends only its lines, foods and notes (D-084 rule 4)', () => {
    const sent = JSON.parse(buildPayload('meals', 'full', true, { ...withBody, mealLines: ['x'] }).message)
    expect(Object.keys(sent).sort()).toEqual(['baseline', 'foods', 'lines'])
  })

  it('Standard and Full keep their additions; Minimal has neither', () => {
    expect(JSON.parse(buildPayload('week_note', 'minimal', false, withBody).message).experience).toBeUndefined()
    expect(JSON.parse(buildPayload('week_note', 'standard', false, withBody).message).experience).toBe('new')
    expect(JSON.parse(buildPayload('week_note', 'full', false, withBody).message).currentWeight).toEqual({ value: 82, unit: 'kg' })
  })

  it('the levels keep D-044 names; Full reads "Adds current weight" (D-084 rule 1)', () => {
    expect(PRIVACY_LEVELS.map((l) => l.title)).toEqual(['Minimal', 'Standard', 'Full'])
    expect(PRIVACY_LEVELS[2].sub).toBe('Adds current weight')
  })
})
