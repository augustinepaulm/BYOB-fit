import { describe, expect, it } from 'vitest'

import type { Exercise, ItemFields, Progression } from '../types/program.ts'
import type { Entry } from '../types/stores.ts'
import { stepsFor, suggestProgression, suggestionText } from './progression.ts'

const bench: Exercise = { name: 'Barbell bench press', howTo: '', muscles: ['chest'], equipment: 'barbell', level: 'intermediate' }
const squat: Exercise = { name: 'Barbell back squat', howTo: '', muscles: ['legs', 'glutes'], equipment: 'barbell', level: 'intermediate' }
const lateral: Exercise = { name: 'Dumbbell lateral raise', howTo: '', muscles: ['shoulders'], equipment: 'dumbbell', level: 'beginner' }
const bare: Exercise = { name: 'Bench press', howTo: '' }

const benchItem: ItemFields = { type: 'load_reps', sets: 4, repMin: 6, repMax: 8 }

/** One session's entry: each set at `weight` with the given reps. */
function entry(weight: number, reps: number[]): Entry {
  return { itemId: 'i', exerciseId: 'e', sets: reps.map((r, i) => ({ n: i + 1, weight, reps: r })) }
}
const eights = (w: number) => entry(w, [8, 8, 8, 8])

describe('suggestProgression (D-047)', () => {
  it('barbell bench 60 kg, two sessions of 8 × 4 → 62.5', () => {
    expect(suggestProgression(benchItem, bench, [eights(60), eights(60)], 'kg')).toEqual({ kind: 'weight', to: 62.5, sessions: 2, sets: 4, reps: 8 })
  })

  it('the same at 135 lb → 140', () => {
    expect(suggestProgression(benchItem, bench, [eights(135), eights(135)], 'lb')).toMatchObject({ kind: 'weight', to: 140 })
  })

  it('barbell back squat 100 kg → 105', () => {
    expect(suggestProgression(benchItem, squat, [eights(100), eights(100)], 'kg')).toMatchObject({ kind: 'weight', to: 105 })
  })

  it('barbell bench 75 kg: 3.75 ties between one and two steps, takes the smaller → 77.5', () => {
    expect(stepsFor(3.75, 2.5)).toBe(1)
    expect(suggestProgression(benchItem, bench, [eights(75), eights(75)], 'kg')).toMatchObject({ kind: 'weight', to: 77.5 })
  })

  it('dumbbell lateral raise 10 kg, 3 × 12 to 15, two sessions of 15 → more reps', () => {
    const item: ItemFields = { type: 'load_reps', sets: 3, repMin: 12, repMax: 15 }
    const s = suggestProgression(item, lateral, [entry(10, [15, 15, 15]), entry(10, [15, 15, 15])], 'kg')
    expect(s).toEqual({ kind: 'reps' })
    expect(suggestionText(s!)).toBe('Aim for more reps at this weight.')
  })

  it('second session 8, 8, 7, 8 → nothing', () => {
    expect(suggestProgression(benchItem, bench, [eights(60), entry(60, [8, 8, 7, 8])], 'kg')).toBeNull()
  })

  it('only one qualifying session → nothing', () => {
    expect(suggestProgression(benchItem, bench, [eights(60)], 'kg')).toBeNull()
    expect(suggestProgression(benchItem, bench, [eights(60), entry(60, [8, 7, 8, 8])], 'kg')).toBeNull()
  })

  it('the two sessions at different weights → nothing', () => {
    expect(suggestProgression(benchItem, bench, [eights(60), eights(57.5)], 'kg')).toBeNull()
  })

  it('progression { sessions: 3, percent: 2, step: 1 } needs three sessions', () => {
    const item: ItemFields & { progression: Progression } = { ...benchItem, progression: { sessions: 3, percent: 2, step: 1 } }
    expect(suggestProgression(item, bench, [eights(60), eights(60)], 'kg')).toBeNull()
    expect(suggestProgression(item, bench, [eights(60), eights(60), eights(60)], 'kg')).toMatchObject({ kind: 'weight', to: 61, sessions: 3 })
  })

  it('an exercise with no metadata at 60 kg → 62.5', () => {
    expect(suggestProgression(benchItem, bare, [eights(60), eights(60)], 'kg')).toMatchObject({ kind: 'weight', to: 62.5 })
    expect(suggestProgression(benchItem, undefined, [eights(60), eights(60)], 'kg')).toMatchObject({ kind: 'weight', to: 62.5 })
  })

  it('only load_reps items with repMax and weights qualify', () => {
    expect(suggestProgression({ ...benchItem, type: 'bodyweight_reps' }, bench, [eights(60), eights(60)], 'kg')).toBeNull()
    expect(suggestProgression({ type: 'load_reps', sets: 4 }, bench, [eights(60), eights(60)], 'kg')).toBeNull()
    const noWeight: Entry = { itemId: 'i', exerciseId: 'e', sets: [1, 2, 3, 4].map((n) => ({ n, reps: 8 })) }
    expect(suggestProgression(benchItem, bench, [noWeight, noWeight], 'kg')).toBeNull()
  })

  it('reads as the amended frame 3b', () => {
    expect(suggestionText({ kind: 'weight', to: 62.5, sessions: 2, sets: 4, reps: 8 })).toBe('Try 62.5, you hit 4 × 8 in your last 2 sessions.')
  })
})
