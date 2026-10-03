// EXEC-13-rework commit H, task 14 (D-081): AI notes on a week.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { MealDay } from '../types/stores.ts'
import { buildPayload } from './payload.ts'
import { WEEK_NOTE_SYSTEM, bodyWeekData, newWeekNote, notesFor, nutritionWeekData, programFor, trainingWeekData } from './weekNotes.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('the system prompt, word for word', () => {
  it('matches task 14', () => {
    expect(WEEK_NOTE_SYSTEM).toBe(
      "You review one week of a person's training, nutrition or body data from a workout app. Write three to five plain sentences: what moved, what held, and one thing to watch next week. Use only the data given; do not recalculate the score. No medical advice, no exclamation marks.",
    )
  })
})

describe('payload per level (D-081 rule 1, D-084 rule 2)', () => {
  const counts = { planned: 5, finished: 4, prescribed: 68, confirmed: 60, up: 3, same: 6, down: 1, newCount: 0 }
  const meals: MealDay[] = [{ date: '2026-09-28', lines: ['2 eggs', 'secret soup'], parsed: { kcal: 2400, proteinG: 160, fibreG: 30, sodiumMg: 2000, items: [{ line: '2 eggs', kcal: 150, proteinG: 12 }] } }]
  const review = (view: 'training' | 'nutrition' | 'body', data: unknown) => ({
    view,
    weekStart: '2026-09-27',
    programWeek: 5,
    score: 76,
    parts: [{ label: 'Workouts done', value: '4 of 5 workouts done', weight: 40 }],
    data,
  })
  const goals = { items: [{ rank: 1, type: 'lose_fat' as const }], timeframeWeeks: 12 as const, startDate: '2026-08-30', currentStats: { weight: 83, weightUnit: 'kg' as const, heightCm: 180, age: 40, sex: 'male' as const }, updatedAt: 'x' }
  const body = [{ date: '2026-10-01', units: 'kg' as const, weight: 83, skeletalMuscle: 34.2, updatedAt: 'x' }]
  const settings = { apiKey: 'sk-ant-SECRET', onboarding: { experience: 'new' as const } }

  for (const level of ['minimal', 'standard', 'full'] as const) {
    it(`training at ${level}: score, parts, counts, body entries; never height, age, sex or the key`, () => {
      const { message } = buildPayload('week_note', level, false, { program: null, sessions: [], goals, settings, bodyEntries: body, weekReview: review('training', trainingWeekData(counts)) })
      const sent = JSON.parse(message)
      expect(sent.task).toBe('week_note')
      expect(sent.score).toBe(76)
      expect(sent.parts).toHaveLength(1)
      expect(sent.weekData).toEqual({ workouts: { finished: 4, planned: 5 }, sets: { confirmed: 60, prescribed: 68 }, progression: { up: 3, same: 6, down: 1, new: 0 } })
      expect(sent.bodyEntries).toEqual([{ date: '2026-10-01', units: 'kg', weight: 83, skeletalMuscle: 34.2 }])
      for (const key of ['heightCm', 'age', 'sex', 'apiKey', 'currentStats']) expect(message).not.toContain(`"${key}"`)
      expect(message).not.toContain('sk-ant-SECRET')
      expect(sent.experience === undefined).toBe(level === 'minimal')
      expect(sent.currentWeight === undefined).toBe(level !== 'full')
    })
  }

  it('nutrition sends daily totals against targets, never food lines', () => {
    const data = nutritionWeekData([{ date: '2026-09-28', logged: true }, { date: '2026-09-29', logged: false }], meals, { kcal: 2720, proteinG: 180, floorApplied: false }, 38)
    const { message } = buildPayload('week_note', 'minimal', false, { program: null, sessions: [], goals, settings, bodyEntries: [], weekReview: review('nutrition', data) })
    expect(JSON.parse(message).weekData).toEqual({
      targets: { kcal: 2720, proteinG: 180, fibreG: 38, floorApplied: false },
      days: [{ date: '2026-09-28', logged: true, kcal: 2400, proteinG: 160, fibreG: 30, sodiumMg: 2000 }, { date: '2026-09-29', logged: false }],
    })
    expect(message).not.toContain('secret soup')
    expect(message).not.toContain('2 eggs')
  })

  it('body sends the comparison behind the score', () => {
    expect(bodyWeekData(null)).toEqual({ comparison: null })
  })

  it('the program goes only with a training review', () => {
    const program = { id: 'p' } as never
    expect(programFor('training', program)).toBe(program)
    expect(programFor('nutrition', program)).toBeNull()
    expect(programFor('body', program)).toBeNull()
  })
})

describe('stored notes (D-081 rule 2)', () => {
  it('a note per week and view, newest first; asking again adds one', () => {
    const a = newWeekNote({ weekStart: '2026-09-27', programWeek: 5, view: 'training', reply: ' First. ', model: 'claude-sonnet-5' }, new Date('2026-10-03T09:00:00Z'))
    const b = newWeekNote({ weekStart: '2026-09-27', programWeek: 5, view: 'training', reply: 'Second.' }, new Date('2026-10-03T10:00:00Z'))
    const other = newWeekNote({ weekStart: '2026-09-27', view: 'nutrition', reply: 'Food.' }, new Date('2026-10-03T11:00:00Z'))
    const older = newWeekNote({ weekStart: '2026-09-20', view: 'training', reply: 'Week 4.' }, new Date('2026-09-26T11:00:00Z'))
    expect(a).toEqual({ id: '2026-10-03T09:00:00.000Z__training', weekStart: '2026-09-27', programWeek: 5, view: 'training', reply: 'First.', at: '2026-10-03T09:00:00.000Z', model: 'claude-sonnet-5' })
    expect(notesFor([a, other, b, older], '2026-09-27', 'training').map((n) => n.reply)).toEqual(['Second.', 'First.'])
    expect(notesFor([a, other, b, older], '2026-09-27', 'nutrition').map((n) => n.reply)).toEqual(['Food.'])
  })
})

describe('the review goes through the budget check and the preview', () => {
  const hook = read('../ai/useWeekReview.tsx')
  it('uses usePreview with kind week_note, so the budget gate runs before the preview opens', () => {
    expect(hook).toContain("kind: 'week_note',")
    expect(hook).toContain('usePreview({')
    expect(hook).toContain('onClick={() => preview.open()}')
    expect(read('../ai/usePreview.tsx')).toContain('gateFor(log, settings, new Date())')
  })
  it('sends kind week_note with the word-for-word system prompt and stores the note', () => {
    expect(hook).toContain("sendAndLog({ kind: 'week_note', level, payload, system: WEEK_NOTE_SYSTEM")
    expect(hook).toContain('await addWeekNote(note)')
  })
  it('each Progress view offers it', () => {
    const progress = read('../screens/ProgressScreen.tsx')
    for (const view of ['training', 'nutrition', 'body']) expect(progress).toContain(`view: '${view}',`)
    expect(progress.match(/useWeekReview\(/g)).toHaveLength(3)
  })
})
