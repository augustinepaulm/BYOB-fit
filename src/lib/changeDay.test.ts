/// <reference types="node" />
// EXEC-12 commit B (D-069 rules 1 to 6, 11): change, restore, the past-date
// rule, the confirmation, Do this today, a mid-workout change keeping logged
// sets, empty sections as drop targets, and no swap UI left. The screens need
// IndexedDB and a router, so they are covered by these rules, source checks,
// and the scripted browser run (task 16).
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import upperLower from '../../public/templates/starter-4day-upper-lower.json'
import type { Program } from '../types/program.ts'
import type { DayChange, Session } from '../types/stores.ts'
import { canChangeDate, changeConfirmation, changedFrom, dayLabel, endedAsItStands } from './dayChanges.ts'
import { dayForDate } from './program.ts'
import { buildDeck } from './session.ts'
import { applyOrder, keepOrder, moveItem, orderOf, planGroups, stepInGroups } from './todayPlan.ts'

const program = { ...(upperLower as unknown as Program), startDate: '2026-08-09', programWeeks: 12 }
const day = (id: string) => program.days.find((d) => d.id === id)!
const SET_AT = '2026-09-29T09:00:00.000Z'
const fri = new Date(2026, 9, 2)
const today = new Date(2026, 8, 29)

describe('change and restore (rules 1 and 2)', () => {
  it('a changed date shows the new day and "was" its own; nothing else moves; restore puts it back', () => {
    const changes: DayChange[] = [{ date: '2026-10-02', dayId: 'mon', setAt: SET_AT }]
    expect(dayForDate(program, changes, fri).id).toBe('mon')
    expect(dayLabel(changedFrom(program, changes, fri, day('mon'))!)).toBe('Lower B')
    expect(dayForDate(program, changes, new Date(2026, 8, 28)).id).toBe('mon')
    expect(changedFrom(program, changes, new Date(2026, 8, 28), day('mon'))).toBeNull()
    const restored = changes.filter((c) => c.date !== '2026-10-02')
    expect(dayForDate(program, restored, fri).id).toBe('fri')
    expect(changedFrom(program, restored, fri, day('fri'))).toBeNull()
  })

  it('dates from today on can change, in any week; past dates cannot', () => {
    expect(canChangeDate('2026-09-29', '2026-09-29')).toBe(true)
    expect(canChangeDate('2026-10-06', '2026-09-29')).toBe(true)
    expect(canChangeDate('2026-09-28', '2026-09-29')).toBe(false)
  })

  it('the provider refuses past dates through the same rule', () => {
    const provider = readFileSync(new URL('../program/ProgramProvider.tsx', import.meta.url), 'utf8')
    expect(provider).toContain('!canChangeDate(date, toISODate(today))) return false')
  })
})

describe('the confirmation (rules 1 and 4)', () => {
  it('names the date and both days', () => {
    const c = changeConfirmation({ date: fri, from: day('fri'), to: day('mon'), isToday: false, loggedToday: false })
    expect(c.title).toBe('Change Fri, Oct 2 from Lower B to Upper A?')
    expect(c.body).toBe('Nothing else moves; Restore puts this date back.')
  })
  it('today with logged sets says what happens to them', () => {
    const c = changeConfirmation({ date: today, from: day('tue'), to: day('thu'), isToday: true, loggedToday: true })
    expect(c.title).toBe('Change Tue, Sep 29 from Lower A to Upper B?')
    expect(c.body).toBe("What you logged today stays under today. Today's session ends as it stands, and Upper B starts as a second session today.")
  })
  it('today without logged sets does not', () => {
    expect(changeConfirmation({ date: today, from: day('tue'), to: day('thu'), isToday: true, loggedToday: false }).body).toBe('Nothing else moves; Restore puts this date back.')
  })
})

describe('Do this today (rule 3) and a mid-workout change (rules 4 and 5)', () => {
  it('today takes the future day’s workout; the future day keeps its own', () => {
    const changes: DayChange[] = [{ date: '2026-09-29', dayId: 'fri', setAt: SET_AT }]
    expect(dayForDate(program, changes, today).id).toBe('fri')
    expect(dayForDate(program, changes, fri).id).toBe('fri')
  })
  it('today’s session ends as it stands, keeping every logged set', () => {
    const session: Session = {
      id: '2026-09-29__tue',
      date: '2026-09-29',
      dayId: 'tue',
      programWeek: 8,
      startedAt: '2026-09-29T09:00:00.000Z',
      entries: [
        { itemId: 'i009', exerciseId: 'back-squat', sets: [{ n: 1, weight: 100, reps: 6 }] },
        { itemId: 'i010', exerciseId: 'bb-rdl', sets: [{ n: 1, weight: 80, reps: 8 }] },
      ],
    }
    const ended = endedAsItStands(session, new Date('2026-09-29T09:30:00.000Z'))
    expect(ended.endedAt).toBe('2026-09-29T09:30:00.000Z')
    expect(ended.entries).toEqual(session.entries)
    expect(endedAsItStands(ended, new Date()).endedAt).toBe('2026-09-29T09:30:00.000Z')
  })
  it('the new day’s session is its own record, keyed by date and day', () => {
    const deck = readFileSync(new URL('../screens/DeckScreen.tsx', import.meta.url), 'utf8')
    expect(deck).toContain('return <Deck key={dayId} />')
    expect(deck).toMatch(/if \(api\.session\) await api\.finish\(\)\s*\n\s*await setChange\(todayIso, dayId\)/)
  })
})

describe('empty sections stay (rule 11)', () => {
  const tue = day('tue')
  const deck = buildDeck(tue, 8, today)
  const moved = applyOrder(deck, tue, moveItem(orderOf(deck), 'i008', 1, 'tue-main', new Set()))

  it('the plan sheet keeps an emptied section as a drop target, in program order', () => {
    const groups = planGroups(moved, tue.sections)
    expect(groups.map((g) => `${g.title}:${g.items.length}`)).toEqual(['Warm-up:0', 'Main:6', 'Core:1'])
  })
  it('Move up from the top of Main goes into the empty Warm-up', () => {
    const groups = planGroups(moved, tue.sections)
    const first = groups[1].items[0].deckItem.item.id
    expect(stepInGroups(groups, first, 'up')).toEqual({ toIndex: 0, toSectionId: 'tue-warmup' })
  })
  it('Keep this order never removes a section', () => {
    const logged = new Map(deck.map((d) => [d.item.id, d.logged]))
    const kept = keepOrder(program, 'tue', orderOf(moved), logged).days.find((d) => d.id === 'tue')!
    expect(kept.sections.map((s) => `${s.id}:${s.items.length}`)).toEqual(['tue-warmup:0', 'tue-main:6', 'tue-abs:1'])
  })
})

describe('no swap UI left (rule 6)', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  it('Week, the provider and the builder have no swap controls', () => {
    const week = read('../screens/WeekScreen.tsx')
    for (const gone of ['Swap days', 'SwapSheet', 'applySwap', 'SwapArrows', 'partnersOf']) expect(week).not.toContain(gone)
    const provider = read('../program/ProgramProvider.tsx')
    expect(provider).not.toMatch(/applySwap|weekPlan/i)
    const builder = read('../builder/FormsBuilder.tsx')
    for (const gone of ['SwapArrows', 'Swappable with', 'setSwappable', 'day-swap']) expect(builder).not.toContain(gone)
  })
  it('swappableWith stays readable in the schema', () => {
    expect(read('../../docs/program.schema.json')).toContain('"swappableWith"')
  })
})
