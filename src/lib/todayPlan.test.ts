// EXEC-11.5 task 11: today's order, moves, the current item, added sets,
// progression with an added set, the two Keep actions, and the backup round trip.
import { describe, expect, it } from 'vitest'

import starter from '../../public/templates/starter-4day-upper-lower.json'
import type { Exercise, ItemFields, Program } from '../types/program.ts'
import type { Entry, Session } from '../types/stores.ts'
import { backupFromData, BACKUP_SCHEMA_VERSION, parseBackup } from './backup.ts'
import { isLogged } from './program.ts'
import { suggestProgression } from './progression.ts'
import { buildDeck } from './session.ts'
import {
  applyOrder,
  currentAfterMove,
  isDeckItemInProgress,
  isDeckItemDone,
  keepOrder,
  keepSets,
  moveItem,
  orderDiffers,
  orderOf,
  setRowsWithAdded,
  setsLoggedToday,
  setsOverrideWeeks,
  stepTarget,
  type OrderEntry,
} from './todayPlan.ts'

const program = starter as unknown as Program
const tuesday = program.days.find((d) => d.id === 'tue')!
const date = new Date(2026, 8, 29)
const deck = buildDeck(tuesday, 1, date)
const ids = (d: { item: { id: string } }[]) => d.map((x) => x.item.id)
const sectionOf = (d: ReturnType<typeof applyOrder>, id: string) => d.find((x) => x.item.id === id)!.section.id

describe('applyOrder (task 4a)', () => {
  it('no order: the program deck', () => {
    expect(ids(applyOrder(deck, tuesday, undefined))).toEqual(['i008', 'i009', 'i010', 'i011', 'i012', 'i013', 'i014'])
  })

  it('listed items in listed order and section, renumbered', () => {
    const order: OrderEntry[] = [
      ...orderOf(deck).filter((o) => o.itemId !== 'i012' && o.itemId !== 'i014'),
      { itemId: 'i012', sectionId: 'tue-abs' },
      { itemId: 'i014', sectionId: 'tue-abs' },
    ]
    const today = applyOrder(deck, tuesday, order)
    expect(ids(today)).toEqual(['i008', 'i009', 'i010', 'i011', 'i013', 'i012', 'i014'])
    expect(sectionOf(today, 'i012')).toBe('tue-abs')
    expect(today.map((d) => d.position)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('missing ids follow at their program position; stale ids are ignored', () => {
    const order: OrderEntry[] = [
      { itemId: 'i013', sectionId: 'tue-main' },
      { itemId: 'gone-1', sectionId: 'tue-main' },
      { itemId: 'i009', sectionId: 'tue-main' },
    ]
    expect(ids(applyOrder(deck, tuesday, order))).toEqual(['i013', 'i009', 'i008', 'i010', 'i011', 'i012', 'i014'])
  })

  it('an item moved to another section keeps how it is logged (D-065 rule 2)', () => {
    const order = moveItem(orderOf(deck), 'i008', 1, 'tue-main', new Set())
    const moved = applyOrder(deck, tuesday, order).find((d) => d.item.id === 'i008')!
    expect(moved.section.kind).toBe('main')
    expect(moved.logged).toBe(false)
  })
})

describe('moves (task 4b)', () => {
  const base = orderOf(deck)

  it('done items never move', () => {
    expect(moveItem(base, 'i009', 5, 'tue-main', new Set(['i009']))).toBe(base)
  })

  it('others go anywhere, including between done items and across sections', () => {
    const done = new Set(['i009', 'i010'])
    const between = moveItem(base, 'i013', 2, 'tue-main', done)
    expect(between.map((o) => o.itemId)).toEqual(['i008', 'i009', 'i013', 'i010', 'i011', 'i012', 'i014'])
    const intoCore = moveItem(base, 'i012', 5, 'tue-abs', done)
    expect(intoCore.slice(4)).toEqual([
      { itemId: 'i013', sectionId: 'tue-main' },
      { itemId: 'i012', sectionId: 'tue-abs' },
      { itemId: 'i014', sectionId: 'tue-abs' },
    ])
  })

  it('Move up and down trade places within a section and cross a header at its edge', () => {
    expect(stepTarget(base, 'i011', 'up')).toEqual({ toIndex: 2, toSectionId: 'tue-main' })
    expect(stepTarget(base, 'i013', 'down')).toEqual({ toIndex: 5, toSectionId: 'tue-abs' })
    expect(stepTarget(base, 'i009', 'up')).toEqual({ toIndex: 1, toSectionId: 'tue-warmup' })
    expect(stepTarget(base, 'i008', 'up')).toBeNull()
    expect(stepTarget(base, 'i014', 'down')).toBeNull()
    // Two downs take i012 past i013 and over the Core header, ahead of i014.
    let order = base
    for (let i = 0; i < 2; i++) {
      const t = stepTarget(order, 'i012', 'down')!
      order = moveItem(order, 'i012', t.toIndex, t.toSectionId, new Set())
    }
    expect(order.map((o) => `${o.itemId}:${o.sectionId}`).slice(4)).toEqual(['i013:tue-main', 'i012:tue-abs', 'i014:tue-abs'])
  })
})

describe('the current item after a move (D-065 rule 3, D-074 rule 1)', () => {
  const before = orderOf(deck)
  it('an item moved ahead of the current one becomes current', () => {
    const after = moveItem(before, 'i012', 0, 'tue-warmup', new Set())
    expect(currentAfterMove(before, after, 'i010', 'i012')).toBe('i012')
  })
  it('an item moved to the current position becomes current; the replaced one follows it', () => {
    const at = before.findIndex((o) => o.itemId === 'i010')
    const after = moveItem(before, 'i013', at, 'tue-main', new Set())
    expect(after[at].itemId).toBe('i013')
    expect(after[at + 1].itemId).toBe('i010')
    expect(currentAfterMove(before, after, 'i010', 'i013')).toBe('i013')
  })
  it('an item moved later changes nothing', () => {
    const after = moveItem(before, 'i011', 5, 'tue-main', new Set())
    expect(currentAfterMove(before, after, 'i010', 'i011')).toBe('i010')
  })
  it('the current item moved earlier: it stays current', () => {
    const after = moveItem(before, 'i011', 1, 'tue-main', new Set())
    expect(currentAfterMove(before, after, 'i011', 'i011')).toBe('i011')
  })
  it('the current item moved later: the item that takes its place is current (unchanged from D-065)', () => {
    const after = moveItem(before, 'i010', 5, 'tue-main', new Set())
    expect(currentAfterMove(before, after, 'i010', 'i010')).toBe('i011')
  })
  it('the replaced item keeps its saved sets and shows as in progress', () => {
    const session = { id: 's', date: '2026-09-29', dayId: 'tue', programWeek: 8, entries: [{ itemId: 'i009', exerciseId: 'back-squat', sets: [{ n: 1, weight: 100, reps: 6 }] }] }
    const squat = deck.find((d) => d.item.id === 'i009')!
    expect(isDeckItemInProgress(squat, session)).toBe(true)
    const all = { ...session, entries: [{ itemId: 'i009', exerciseId: 'back-squat', sets: [1, 2, 3, 4].map((n) => ({ n, weight: 100, reps: 6 })) }] }
    expect(isDeckItemInProgress(squat, all)).toBe(false)
    expect(isDeckItemInProgress(squat, undefined)).toBe(false)
  })
  it('done items stay locked, so nothing changes', () => {
    const after = moveItem(before, 'i009', 5, 'tue-main', new Set(['i009']))
    expect(after).toBe(before)
    expect(currentAfterMove(before, after, 'i010', 'i009')).toBe('i010')
  })
})

describe('added sets (task 4d)', () => {
  it('set numbers continue after the prescription', () => {
    expect(setRowsWithAdded({ sets: 3 }, 1)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }])
    expect(setRowsWithAdded({ sets: 3 }, undefined)).toHaveLength(3)
  })
  it('per-side items get an L and an R row per added set', () => {
    expect(setRowsWithAdded({ sets: 2, perSide: true }, 1).slice(4)).toEqual([
      { n: 3, side: 'L' },
      { n: 3, side: 'R' },
    ])
  })
  it('sets logged today counts set numbers with a value', () => {
    const entry: Entry = { itemId: 'i010', exerciseId: 'x', sets: [{ n: 1, weight: 50, reps: 8 }, { n: 2, weight: 50, reps: 8 }, { n: 4, weight: 50, reps: 8 }, { n: 3, raw: 'oops' }], addedSets: 1 }
    expect(setsLoggedToday(entry)).toBe(3)
  })
})

describe('progression with an added set (D-065 rule 6)', () => {
  const item: ItemFields = { exerciseId: 'leg-press', type: 'load_reps', sets: 3, repMin: 8, repMax: 10, unit: 'kg' }
  const exercise: Exercise = { name: 'Leg press', howTo: '', muscles: ['legs'], equipment: 'machine' }
  const entry = (lastReps: number): Entry => ({
    itemId: 'i010',
    exerciseId: 'leg-press',
    sets: [1, 2, 3, 4].map((n) => ({ n, weight: 100, reps: n === 4 ? lastReps : 10 })),
    addedSets: 1,
  })
  it('4 sets at one weight, all at repMax: a suggestion that says 4 sets', () => {
    const s = suggestProgression(item, exercise, [entry(10), entry(10)], 'kg')
    expect(s).toMatchObject({ kind: 'weight', sets: 4, reps: 10 })
  })
  it('set 4 below repMax: none', () => {
    expect(suggestProgression(item, exercise, [entry(8), entry(10)], 'kg')).toBeNull()
  })
})

describe('Keep N sets (D-055, D-065 rule 7)', () => {
  it('raises the base sets and leaves byWeek identical', () => {
    const withOverride: Program = structuredClone(program)
    const target = withOverride.days.find((d) => d.id === 'tue')!.sections[1].items[1]
    target.byWeek = { '5': { sets: 2 }, '7': { repMax: 12 } }
    const kept = keepSets(withOverride, 'i010', 4)
    const after = kept.days.find((d) => d.id === 'tue')!.sections[1].items[1]
    expect(after.sets).toBe(4)
    expect(JSON.stringify(after.byWeek)).toBe(JSON.stringify(target.byWeek))
    expect(setsOverrideWeeks(withOverride, 'i010')).toEqual([5])
    // Nothing else changed, apart from the day's "about N min", which the
    // builder recomputes for a day whose sections changed (D-042 rule 8).
    after.sets = target.sets
    const day = (p: Program) => p.days.find((d) => d.id === 'tue')!
    expect(day(kept).durationMin).toBe(60)
    day(kept).durationMin = day(withOverride).durationMin
    expect(JSON.stringify(kept)).toBe(JSON.stringify(withOverride))
  })
})

describe('Keep this order (D-063 rule 6, D-065 rule 2)', () => {
  const logged = new Map(deck.map((d) => [d.item.id, d.logged]))
  it('moves an item between sections and keeps the rest of the day', () => {
    const order = moveItem(orderOf(deck), 'i012', 5, 'tue-abs', new Set())
    const kept = keepOrder(program, 'tue', order, logged)
    const day = kept.days.find((d) => d.id === 'tue')!
    expect(day.sections.map((s) => s.items.map((i) => i.id))).toEqual([['i008'], ['i009', 'i010', 'i011', 'i013'], ['i012', 'i014']])
    // Main and Core log the same way, so `logged` is not written.
    expect(day.sections[2].items[0]).toEqual(program.days.find((d) => d.id === 'tue')!.sections[1].items[3])
    expect(orderDiffers(buildDeck(day, 1, date), applyOrder(deck, tuesday, order))).toBe(false)
  })
  it('writes logged only when the new section kind would change it', () => {
    const order = moveItem(orderOf(deck), 'i008', 0, 'tue-main', new Set())
    const day = keepOrder(program, 'tue', order, logged).days.find((d) => d.id === 'tue')!
    const moved = day.sections[1].items[0]
    expect(moved.id).toBe('i008')
    expect(moved.logged).toBe(false)
    expect(isLogged('main', moved)).toBe(false)
    expect(day.sections[0].items).toEqual([])
  })
})

describe('done, as the sheet and Resume read it', () => {
  it('a logged item is done with a value; a check item when checked', () => {
    const session = { id: 's', date: '2026-09-29', dayId: 'tue', programWeek: 1, entries: [{ itemId: 'i009', exerciseId: 'x', sets: [{ n: 1, weight: 60, reps: 8 }] }, { itemId: 'i008', exerciseId: 'y', sets: [], checked: true }] } as Session
    expect(isDeckItemDone(deck[0], session)).toBe(true)
    expect(isDeckItemDone(deck[1], session)).toBe(true)
    expect(isDeckItemDone(deck[2], session)).toBe(false)
  })
})

describe('backup round trip (D-065 rules 1 and 5)', () => {
  it('keeps order and addedSets', () => {
    const session: Session = {
      id: '2026-09-29__tue',
      date: '2026-09-29',
      dayId: 'tue',
      programWeek: 8,
      entries: [{ itemId: 'i010', exerciseId: 'leg-press', sets: [{ n: 4, weight: 100, reps: 10 }], addedSets: 1 }],
      order: moveItem(orderOf(deck), 'i012', 5, 'tue-abs', new Set()),
    }
    const file = backupFromData({
      programs: [program],
      sessions: [session],
      dayChanges: [],
      meals: [],
      profile: null,
      settings: null,
      reprograms: [],
      meta: {},
      goals: null,
      sentLog: [],
      bodyEntries: [],
      weekNotes: [],
    })
    expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    // D-069 moved the envelope to version 3 and Phase 13 to 4; order and addedSets need no change.
    expect(BACKUP_SCHEMA_VERSION).toBe(4)
    const back = parseBackup(JSON.stringify(file))
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.backup.sessions).toEqual([session])
  })
})
