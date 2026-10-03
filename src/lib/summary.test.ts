/// <reference types="node" />
// EXEC-11.8 commit A (D-074 rules 3 to 5): rest on Done, the summary's
// comparison with last week and Ready to progress, and the comparable
// reference.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { Item, ItemFields, Section } from '../types/program.ts'
import type { Entry, Session } from '../types/stores.ts'
import { findReferenceEntry, summarise, type DeckItem } from './session.ts'
import { compareWithLastWeek, readyToProgress } from './summary.ts'
import { restAfterDone } from './todayPlan.ts'

const main: Section = { id: 'main', kind: 'main', title: 'Main', items: [] }
function deckItem(id: string, exerciseId: string, fields: ItemFields): DeckItem {
  const item = { id, exerciseId, ...fields } as Item
  return { position: 1, section: main, item, resolved: { ...fields, id, exerciseId }, logged: true }
}
function session(date: string, entries: Entry[], ended = true): Session {
  return { id: `${date}__mon`, date, dayId: 'mon', programWeek: 1, startedAt: `${date}T09:00:00.000Z`, ...(ended ? { endedAt: `${date}T10:00:00.000Z` } : {}), entries }
}
const load = (itemId: string, exerciseId: string, sets: [number, number][]): Entry => ({ itemId, exerciseId, sets: sets.map(([weight, reps], i) => ({ n: i + 1, weight, reps })) })

describe('rest on Done (D-074 rule 3)', () => {
  const now = 1_000_000
  it('Done that saved a new set starts the finished exercise’s full rest now', () => {
    expect(restAfterDone(now - 10_000 + 90_000, 1, 90, now)).toBe(now + 90_000)
    expect(restAfterDone(null, 2, 120, now)).toBe(now + 120_000)
  })
  it('Done that saved nothing new leaves the timer as it was', () => {
    expect(restAfterDone(now + 80_000, 0, 90, now)).toBe(now + 80_000)
    expect(restAfterDone(null, 0, 90, now)).toBeNull()
  })
  it('the deck counts Done’s saves and applies the rule after them', () => {
    const deck = readFileSync(new URL('../screens/DeckScreen.tsx', import.meta.url), 'utf8')
    expect(deck).toContain("if (action === 'done') savedByDone.current += 1")
    expect(deck).toContain('setRestUntil((until) => restAfterDone(until, savedByDone.current, current.resolved.restSec, Date.now()))')
  })
})

describe('the comparable reference (D-074 rule 5)', () => {
  const repsOnly: Entry = { itemId: 'i1', exerciseId: 'fly', sets: [{ n: 1, reps: 15 }, { n: 2, reps: 20 }] }
  const weighted = load('i1', 'fly', [[110, 10]])
  it('a reps-only entry of the same exercise is skipped for a load item; the next comparable one is used', () => {
    const sessions = [session('2026-09-21', [weighted]), session('2026-09-28', [repsOnly])]
    expect(findReferenceEntry(sessions, 'mon', 'fly', 'load_reps')).toBe(weighted)
  })
  it('none comparable gives no reference', () => {
    expect(findReferenceEntry([session('2026-09-28', [repsOnly])], 'mon', 'fly', 'load_reps')).toBeUndefined()
  })
  it('other types need the same type', () => {
    const hold: Entry = { itemId: 'i2', exerciseId: 'plank', sets: [{ n: 1, seconds: 40 }] }
    const sessions = [session('2026-09-21', [hold]), session('2026-09-28', [{ itemId: 'i2', exerciseId: 'plank', sets: [{ n: 1, reps: 3 }] }])]
    expect(findReferenceEntry(sessions, 'mon', 'plank', 'timed_hold')).toBe(hold)
    expect(findReferenceEntry(sessions, 'mon', 'plank', 'bodyweight_reps')?.sets[0].reps).toBe(3)
  })
})

describe('Compared with last week (D-074 rule 4)', () => {
  const deck = [
    deckItem('a', 'fly', { type: 'load_reps', sets: 2, repMin: 8, repMax: 12, unit: 'lb' }),
    deckItem('b', 'curl', { type: 'load_reps', sets: 2, repMin: 8, repMax: 12, unit: 'lb' }),
    deckItem('c', 'row', { type: 'load_reps', sets: 2, repMin: 8, repMax: 12, unit: 'kg' }),
    deckItem('d', 'press', { type: 'load_reps', sets: 2, repMin: 8, repMax: 12, unit: 'kg' }),
    deckItem('e', 'pullup', { type: 'bodyweight_reps', sets: 2, repMin: 5, repMax: 10 }),
    deckItem('f', 'plank', { type: 'timed_hold', sets: 2, holdSec: 45 }),
    deckItem('g', 'lunge', { type: 'load_reps', sets: 2, repMin: 8, repMax: 12, unit: 'kg' }),
  ]
  const last = session('2026-09-28', [
    load('a', 'fly', [[110, 10], [110, 9]]),
    load('b', 'curl', [[30, 10], [30, 9]]),
    load('c', 'row', [[60, 10]]),
    load('d', 'press', [[40, 10]]),
    { itemId: 'e', exerciseId: 'pullup', sets: [{ n: 1, reps: 8 }] },
    { itemId: 'f', exerciseId: 'plank', sets: [{ n: 1, seconds: 45 }] },
  ])
  const today = session('2026-10-05', [
    load('a', 'fly', [[120, 10], [110, 10]]),
    load('b', 'curl', [[30, 12], [30, 10]]),
    load('c', 'row', [[60, 10]]),
    load('d', 'press', [[37.5, 10]]),
    { itemId: 'e', exerciseId: 'pullup', sets: [{ n: 1, reps: 7 }] },
    { itemId: 'f', exerciseId: 'plank', sets: [{ n: 1, seconds: 50 }] },
    load('g', 'lunge', [[20, 10]]),
  ], false)
  const c = compareWithLastWeek(today, deck, [last, today], 'mon')

  it('up by weight, up by reps at the same weight, and timed up', () => {
    expect(c.upLines).toEqual([
      { exerciseId: 'fly', today: '120 lb × 10', last: '110 lb × 10' },
      { exerciseId: 'curl', today: '30 lb × 12', last: '30 lb × 10' },
      { exerciseId: 'plank', today: '50 s', last: '45 s' },
    ])
  })
  it('same, down by weight, reps-only down; counts', () => {
    expect([c.up, c.same, c.down]).toEqual([3, 1, 2])
  })
  it('a first-time exercise is listed as New and not counted', () => {
    expect(c.newIds).toEqual(['lunge'])
  })
  it('an earlier entry without weight makes a load exercise New', () => {
    const noWeight = session('2026-09-28', [{ itemId: 'g', exerciseId: 'lunge', sets: [{ n: 1, reps: 15 }] }])
    const r = compareWithLastWeek(today, deck, [last, noWeight, today], 'mon')
    expect(r.newIds).toEqual(['lunge'])
    expect([r.up, r.same, r.down]).toEqual([3, 1, 2])
  })
  it('the summary no longer carries volume', () => {
    expect(summarise(today, deck)).not.toHaveProperty('volumeByUnit')
    const screens = ['DeckScreen', 'TodayScreen'].map((f) => readFileSync(new URL(`../screens/${f}.tsx`, import.meta.url), 'utf8'))
    for (const s of screens) expect(s).not.toMatch(/volumeByUnit|Volume, /)
  })
})

describe('Ready to progress (D-074 rule 4b)', () => {
  const deck = [deckItem('a', 'bench', { type: 'load_reps', sets: 2, repMin: 6, repMax: 8, unit: 'kg' })]
  const top = (date: string, ended = true) => session(date, [load('a', 'bench', [[60, 8], [60, 8]])], ended)
  it('fires with this session counted as the latest, with the suggestion’s words', () => {
    const today = top('2026-10-05', false)
    expect(readyToProgress(today, deck, [top('2026-09-28'), today], () => ({ name: 'Bench', muscles: ['chest'], equipment: 'barbell' }) as never)).toEqual([
      { exerciseId: 'bench', text: 'Try 62.5, you hit 2 × 8 in your last 2 sessions.' },
    ])
  })
  it('not when a set fell short, and not for a changed entry', () => {
    const short = session('2026-10-05', [load('a', 'bench', [[60, 8], [60, 7]])], false)
    expect(readyToProgress(short, deck, [top('2026-09-28'), short], () => undefined)).toEqual([])
    const changed = session('2026-10-05', [{ ...load('a', 'bench', [[60, 8], [60, 8]]), changed: true as const, fields: { type: 'load_reps' as const } }], false)
    expect(readyToProgress(changed, deck, [top('2026-09-28'), changed], () => undefined)).toEqual([])
  })
})
