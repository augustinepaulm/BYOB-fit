import { describe, expect, it } from 'vitest'

import type { Session } from '../types/stores.ts'
import { bestSetChange, bestSetOf, defaultWeeks, setsInWeek, weeksWithExercise } from './log.ts'

function session(date: string, week: number, sets: [number, number][]): Session {
  return {
    id: `${date}__mon`,
    date,
    dayId: 'mon',
    programWeek: week,
    entries: [{ itemId: 's006', exerciseId: 'bench-press', sets: sets.map(([weight, reps], i) => ({ n: i + 1, weight, reps })) }],
  }
}

const sessions = [
  session('2026-09-07', 1, [[57.5, 8], [57.5, 8], [57.5, 8], [55, 8]]),
  session('2026-09-14', 2, [[60, 8], [60, 8], [60, 7], [57.5, 8]]),
  session('2026-09-21', 3, [[62.5, 8], [62.5, 8], [62.5, 7], [60, 8]]),
]

describe('week against week (frame 3i)', () => {
  it('lists the weeks with the exercise, newest first, and defaults to the latest two', () => {
    const weeks = weeksWithExercise(sessions, 'bench-press')
    expect(weeks).toEqual([3, 2, 1])
    expect(defaultWeeks(weeks)).toEqual({ to: 3, from: 2 })
    expect(defaultWeeks([4])).toEqual({ to: 4, from: null })
  })

  it('takes a week’s sets in order, and its best set by weight then reps', () => {
    const w2 = setsInWeek(sessions, 'bench-press', 2)
    expect(w2.map((s) => `${s.weight} × ${s.reps}`)).toEqual(['60 × 8', '60 × 8', '60 × 7', '57.5 × 8'])
    expect(bestSetOf(w2)).toMatchObject({ weight: 60, reps: 8 })
  })

  it('states the change between best sets as the frame does', () => {
    const a = bestSetOf(setsInWeek(sessions, 'bench-press', 2))
    const b = bestSetOf(setsInWeek(sessions, 'bench-press', 3))
    expect(bestSetChange(a, b, 'kg')).toBe('+2.5 kg on the best set, same reps')
    expect(bestSetChange({ n: 1, weight: 60, reps: 8 }, { n: 1, weight: 60, reps: 10 }, 'kg')).toBe('Same weight on the best set, 2 more reps')
    expect(bestSetChange({ n: 1, weight: 60, reps: 8 }, { n: 1, weight: 57.5, reps: 7 }, 'lb')).toBe('−2.5 lb on the best set, 1 fewer rep')
    expect(bestSetChange(undefined, b, 'kg')).toBeNull()
  })
})

describe('exerciseNames (Phase 10A fix)', () => {
  it('names an exercise that exists only in a starter program', async () => {
    const { exerciseNames } = await import('./log.ts')
    const starter = (await import('../../public/templates/starter-3day-fullbody.json')).default as unknown as import('../types/program.ts').Program
    const sample = (await import('../../public/sample-program.json')).default as unknown as import('../types/program.ts').Program
    expect(sample.exercises['goblet-squat']).toBeUndefined()
    const names = exerciseNames(sample, [sample], [starter])
    expect(names.get('goblet-squat')).toBe('Goblet squat')
    expect(names.get('bench-press')).toBe('Barbell bench press')
    expect(names.get('nowhere')).toBeUndefined()
  })
})
