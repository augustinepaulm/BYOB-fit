/// <reference types="node" />
// EXEC-12 commit C (D-069 rules 7 to 10): add an exercise, swap with its own
// prescription, progression, Log edit and the payload marks. The screens need
// IndexedDB and a router, so they are covered by these rules, source checks,
// and the scripted browser run (task 16).
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import upperLower from '../../public/templates/starter-4day-upper-lower.json'
import type { Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { buildExerciseLog } from './log.ts'
import { compactSessions } from './reprogram.ts'
import { buildDeck, findReferenceEntry, referenceSet } from './session.ts'
import {
  addableItems,
  addedDeckItems,
  addedEntry,
  editLoggedSet,
  effectiveDeckItem,
  insertAfter,
  keepAddedInProgram,
  newAddedItemId,
  progressionHistory,
  replaceSet,
  searchAddable,
  swapPrefill,
} from './sessionExercises.ts'
import { applyOrder, orderOf } from './todayPlan.ts'

const program = { ...(upperLower as unknown as Program), startDate: '2026-08-09', programWeeks: 12 }
const day = (id: string) => program.days.find((d) => d.id === id)!
const today = new Date(2026, 8, 29)
const WEEK = 8
const NOW = new Date('2026-09-29T10:00:00.000Z')

function session(over: Partial<Session> = {}): Session {
  return { id: '2026-09-29__tue', date: '2026-09-29', dayId: 'tue', programWeek: WEEK, startedAt: '2026-09-29T09:00:00.000Z', entries: [], ...over }
}

describe('the add list (rule 7)', () => {
  const items = addableItems(program, WEEK, today)
  it('lists every active item across all days as exercise · day · prescription', () => {
    const total = program.days.reduce((n, d) => n + d.sections.reduce((m, s) => m + s.items.length, 0), 0)
    expect(items).toHaveLength(total)
    const bench = items.find((i) => i.item.id === 'i002')!
    expect(bench.label.split(' · ').slice(0, 2)).toEqual([bench.name, 'Upper A'])
    expect(bench.label.split(' · ')).toHaveLength(3)
  })
  it('an exercise on two days is listed once per day', () => {
    const bike = searchAddable(items, 'bike')
    expect(bike.map((i) => i.day.id)).toEqual(['mon', 'tue', 'thu', 'fri'])
  })
  it('search is by name, case-insensitive; empty shows all', () => {
    expect(searchAddable(items, '  LEG CURL ').map((i) => i.item.id)).toEqual(['i012'])
    expect(searchAddable(items, '')).toHaveLength(items.length)
  })
  it('a retired item is not offered', () => {
    const retired = structuredClone(program)
    retired.days.find((d) => d.id === 'mon')!.sections[1].items[0].retiredFrom = '2026-09-01'
    expect(addableItems(retired, WEEK, today).some((i) => i.item.id === 'i002')).toBe(false)
  })
})

describe('inserting an added entry (rule 7)', () => {
  const tue = day('tue')
  const deck = buildDeck(tue, WEEK, today)
  const source = addableItems(program, WEEK, today).find((i) => i.item.id === 'i024')!
  const id = newAddedItemId(program, session())
  const entry = addedEntry(source, id)

  it('a new item id, where it came from, and the source fields', () => {
    expect(id).toBe('added-1')
    expect(newAddedItemId(program, session({ entries: [entry] }))).toBe('added-2')
    expect(entry.added).toEqual({ fromItemId: 'i024' })
    expect(entry.exerciseId).toBe('deadlift')
    expect(entry.fields?.sets).toBe(source.resolved.sets)
    expect(entry.fields).not.toHaveProperty('id')
  })
  it('goes right after the current item, in its section, and today’s order includes it', () => {
    const order = insertAfter(orderOf(deck), 'i010', id, 'tue-main')
    expect(order.map((o) => o.itemId)).toEqual(['i008', 'i009', 'i010', id, 'i011', 'i012', 'i013', 'i014'])
    const withAdded = applyOrder([...deck, ...addedDeckItems(session({ entries: [entry] }), program, tue)], tue, order)
    expect(withAdded.map((d) => d.item.id)).toEqual(order.map((o) => o.itemId))
    expect(withAdded[3].resolved.exerciseId).toBe('deadlift')
    expect(withAdded[3].logged).toBe(true)
  })
  it('Keep in program puts a copy after the program item it followed', () => {
    const order = insertAfter(orderOf(deck), 'i010', id, 'tue-main')
    const kept = keepAddedInProgram(program, 'tue', order, entry)
    const items = kept.days.find((d) => d.id === 'tue')!.sections.find((s) => s.id === 'tue-main')!.items
    expect(items.map((i) => i.exerciseId)).toEqual(['back-squat', 'bb-rdl', 'deadlift', 'leg-press', 'leg-curl', 'calf-raise'])
    const copy = items[2]
    expect(copy.id).not.toBe('i024')
    expect(copy.id).not.toBe(id)
    expect(kept.days.find((d) => d.id === 'fri')!.sections[1].items[0].id).toBe('i024')
  })
  it('Keep in program waits for a builder draft, like the other Keep controls', () => {
    const deckSource = readFileSync(new URL('../screens/DeckScreen.tsx', import.meta.url), 'utf8')
    const gate = deckSource.indexOf('draftWaiting ? (')
    const keep = deckSource.indexOf('Keep {nameOf(e.exerciseId)} in program')
    const note = deckSource.indexOf('Finish or discard your program draft first')
    expect(gate).toBeGreaterThan(0)
    expect(note).toBeGreaterThan(gate)
    expect(keep).toBeGreaterThan(note)
  })
})

describe('swap step prefill (rule 8)', () => {
  const warmup = buildDeck(day('tue'), WEEK, today)[0]
  it('from the exercise’s first active item elsewhere in the program', () => {
    const p = swapPrefill(program, 'deadlift', 'i008', WEEK, today, warmup.resolved)
    expect(p.from).toBe('elsewhere')
    expect(p.fields.exerciseId).toBe('deadlift')
    expect(p.fields.type).toBe('load_reps')
  })
  it('falls back to the swapped item', () => {
    const p = swapPrefill(program, 'plank', 'i008', WEEK, today, warmup.resolved)
    expect(p.from).toBe('swapped')
    expect(p.fields.exerciseId).toBe('plank')
    expect(p.fields.type).toBe('cardio_block')
  })
  it('a changed entry logs by its own fields', () => {
    const entry = { itemId: 'i008', exerciseId: 'plank', sets: [], changed: true as const, fields: { type: 'timed_hold' as const, sets: 3, holdSec: 45 } }
    const effective = effectiveDeckItem(warmup, entry)
    expect(effective.resolved.type).toBe('timed_hold')
    expect(effective.resolved.sets).toBe(3)
    expect(effective.logged).toBe(true)
    expect(effectiveDeckItem(warmup, { itemId: 'i008', exerciseId: 'bike-easy', sets: [] })).toBe(warmup)
  })
})

describe('history and progression (rule 9)', () => {
  const ended = (date: string, entries: Session['entries']) => session({ id: `${date}__tue`, date, endedAt: `${date}T10:00:00.000Z`, entries })
  const sessions = [
    ended('2026-09-15', [{ itemId: 'i009', exerciseId: 'back-squat', sets: [{ n: 1, weight: 100, reps: 6 }] }]),
    ended('2026-09-22', [{ itemId: 'i009', exerciseId: 'back-squat', sets: [{ n: 1, weight: 60, reps: 12 }], changed: true, fields: { type: 'load_reps', sets: 1 } }]),
    ended('2026-09-24', [{ itemId: 'added-1', exerciseId: 'deadlift', sets: [{ n: 1, weight: 140, reps: 5 }], added: { fromItemId: 'i024' } }]),
  ]
  it('progression ignores changed entries', () => {
    expect(progressionHistory(sessions, 'i009', 'back-squat', '2026-09-29').map((e) => e.sets[0].weight)).toEqual([100])
  })
  it('the reference lookup and Log count added and changed entries', () => {
    expect(findReferenceEntry(sessions, 'tue', 'back-squat')?.sets[0].weight).toBe(60)
    expect(findReferenceEntry(sessions, 'fri', 'deadlift')?.sets[0].weight).toBe(140)
    const log = buildExerciseLog(sessions)
    expect(log.get('back-squat')?.map((s) => s.date)).toEqual(['2026-09-22', '2026-09-15'])
    expect(log.get('deadlift')?.map((s) => s.date)).toEqual(['2026-09-24'])
  })
})

describe('edit from Log (rule 10)', () => {
  const set = { n: 2, weight: 100, reps: 6 }
  it('parses through the deck’s boxes and records the edit time', () => {
    const r = editLoggedSet(set, 'load_reps', { weight: '102.5', reps: '5' }, NOW)
    expect(r).toEqual({ ok: true, set: { n: 2, weight: 102.5, reps: 5, editedAt: NOW.toISOString() } })
  })
  it('invalid input reports errors under the boxes and changes nothing', () => {
    const r = editLoggedSet(set, 'load_reps', { weight: 'abc', reps: '' }, NOW)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.weight).toBeTruthy()
    expect(r.errors.reps).toBeTruthy()
    expect(set).toEqual({ n: 2, weight: 100, reps: 6 })
  })
  it('one-box types edit their own value, keeping the side', () => {
    const r = editLoggedSet({ n: 1, side: 'L', seconds: 30 }, 'timed_hold', { value: '40' }, NOW)
    expect(r).toEqual({ ok: true, set: { n: 1, side: 'L', seconds: 40, editedAt: NOW.toISOString() } })
    expect(editLoggedSet({ n: 1, reps: 8 }, 'bodyweight_reps', { value: '0.5' }, NOW).ok).toBe(false)
  })
  it('the edit becomes the next reference', () => {
    const s = session({ endedAt: '2026-09-29T10:00:00.000Z', entries: [{ itemId: 'i009', exerciseId: 'back-squat', sets: [{ n: 1, weight: 100, reps: 6 }, set] }] })
    const r = editLoggedSet(set, 'load_reps', { weight: '105', reps: '4' }, NOW)
    if (!r.ok) throw new Error('edit failed')
    const edited = replaceSet(s, 'i009', r.set)
    expect(edited.entries[0].sets[0]).toEqual({ n: 1, weight: 100, reps: 6 })
    const ref = referenceSet(findReferenceEntry([edited], 'tue', 'back-squat'), { n: 2 })
    expect(ref).toMatchObject({ weight: 105, reps: 4 })
    expect(ref?.editedAt).toBe(NOW.toISOString())
  })
  it('only ended sessions offer Edit', () => {
    const source = readFileSync(new URL('../screens/LogHistory.tsx', import.meta.url), 'utf8')
    expect(source).toContain('{session.endedAt && (')
  })
})

describe('payload marks (rules 9 and 10)', () => {
  it('marks added today, changed today with its fields, and edited sets', () => {
    const fields = { type: 'timed_hold' as const, sets: 3, holdSec: 45 }
    const [c] = compactSessions([
      session({
        endedAt: '2026-09-29T10:00:00.000Z',
        entries: [
          { itemId: 'i008', exerciseId: 'plank', sets: [{ n: 1, seconds: 45 }], changed: true, fields },
          { itemId: 'added-1', exerciseId: 'deadlift', sets: [{ n: 1, weight: 140, reps: 5, editedAt: NOW.toISOString() }], added: { fromItemId: 'i024' }, fields: { type: 'load_reps' } },
          { itemId: 'i009', exerciseId: 'back-squat', sets: [{ n: 1, weight: 100, reps: 6 }] },
        ],
      }),
    ])
    expect(c.entries[0]).toMatchObject({ mark: 'changed today', fields })
    expect(c.entries[1].mark).toBe('added today')
    expect(c.entries[1]).not.toHaveProperty('fields')
    expect(c.entries[1].sets?.[0].mark).toBe('edited')
    expect(c.entries[2]).not.toHaveProperty('mark')
    expect(c.entries[2].sets?.[0].mark).toBeUndefined()
  })
})
