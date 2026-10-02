/// <reference types="node" />
// EXEC-12 commit A (D-069): weekly swap pairs become per-date day changes.
// fake-indexeddb is not installed, so the database upgrade is tested as its
// conversion function plus a check of how database.ts wires it; the real
// upgrade is checked in the browser (task 16b).
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import fullBody from '../../public/templates/starter-3day-fullbody.json'
import upperLower from '../../public/templates/starter-4day-upper-lower.json'
import split from '../../public/templates/starter-5day-split.json'
import sample from '../../public/sample-program.json'
import type { Day, Program } from '../types/program.ts'
import { backupFromData, parseBackup } from './backup.ts'
import { toISODate } from './dates.ts'
import { dayChangesFromWeekPlans, type LegacyWeekPlan } from './dayChanges.ts'
import { dayForDate, weekDates } from './program.ts'

/** The lookup as it was before version 4: the weekday's day, redirected by that week's pairs. */
function legacyDayForDate(program: Program, plan: LegacyWeekPlan | undefined, date: Date): Day {
  const scheduled = program.days.find((d) => d.order === date.getDay())!
  for (const [a, b] of plan?.swaps ?? []) {
    if (a === scheduled.id) return program.days.find((d) => d.id === b)!
    if (b === scheduled.id) return program.days.find((d) => d.id === a)!
  }
  return scheduled
}

const withDates = (p: unknown): Program => ({ ...(p as Program), startDate: '2026-08-09', programWeeks: 12 })
const STARTERS: [string, Program][] = [
  ['3-day', withDates(fullBody)],
  ['4-day', withDates(upperLower)],
  ['5-day', withDates(split)],
]
const SET_AT = '2026-09-29T09:00:00.000Z'

describe('dayChangesFromWeekPlans (database version 4, envelopes 1 and 2)', () => {
  for (const [name, program] of STARTERS) {
    it(`${name} starter: every date of three weeks matches the old lookup`, () => {
      const [d1, d2, d3, d4] = program.days.map((d) => d.id)
      const rest = program.days.find((d) => d.rest)!.id
      const training = program.days.filter((d) => !d.rest).map((d) => d.id)
      // Week 7 has no swaps; weeks 8 and 9 do, one of them with a rest day.
      const plans: LegacyWeekPlan[] = [
        { programWeek: 8, swaps: [[training[0], training[1]], [d3, d4]] },
        { programWeek: 9, swaps: [[rest, training[training.length - 1]]] },
      ]
      expect([d1, d2]).toHaveLength(2)
      const changes = dayChangesFromWeekPlans(program, plans, SET_AT)
      let checked = 0
      for (const week of [7, 8, 9]) {
        const plan = plans.find((p) => p.programWeek === week)
        for (const date of weekDates(program, week)) {
          expect(dayForDate(program, changes, date).id, `${toISODate(date)}`).toBe(legacyDayForDate(program, plan, date).id)
          checked++
        }
      }
      expect(checked).toBe(21)
      // Only swapped dates get a record; week 7 gets none.
      expect(changes.every((c) => c.date >= '2026-09-27' && c.setAt === SET_AT)).toBe(true)
    })
  }

  it('drops pairs naming a day the program no longer has, and needs a program', () => {
    const program = STARTERS[1][1]
    expect(dayChangesFromWeekPlans(program, [{ programWeek: 8, swaps: [['mon', 'gone']] }], SET_AT)).toEqual([])
    expect(dayChangesFromWeekPlans(null, [{ programWeek: 8, swaps: [['mon', 'tue']] }], SET_AT)).toEqual([])
  })
})

describe('dayForDate with day changes', () => {
  const program = STARTERS[1][1]
  const fri = new Date(2026, 9, 2)
  it('without changes, the weekday; with one, the changed day; nothing else moves', () => {
    expect(dayForDate(program, [], fri).id).toBe('fri')
    const changes = [{ date: '2026-10-02', dayId: 'mon', setAt: SET_AT }]
    expect(dayForDate(program, changes, fri).id).toBe('mon')
    expect(dayForDate(program, changes, new Date(2026, 8, 28)).id).toBe('mon')
    expect(dayForDate(program, changes, new Date(2026, 9, 5)).id).toBe('mon')
  })
  it('a stale day id is ignored', () => {
    expect(dayForDate(program, [{ date: '2026-10-02', dayId: 'old-day', setAt: SET_AT }], fri).id).toBe('fri')
  })
})

describe('export envelope version 3 (D-069)', () => {
  const program = withDates(sample)
  it('round-trips day changes at version 3', () => {
    const data = {
      programs: [program],
      sessions: [],
      dayChanges: [{ date: '2026-10-02', dayId: 'mon', setAt: SET_AT }],
      meals: [],
      profile: null,
      settings: null,
      reprograms: [],
      meta: { activeProgramId: program.id },
      goals: null,
      sentLog: [],
    }
    const file = backupFromData(data, new Date('2026-09-29T10:00:00Z'))
    expect(file.schemaVersion).toBe(3)
    const back = parseBackup(JSON.stringify(file))
    expect(back.ok && back.backup.dayChanges).toEqual(data.dayChanges)
  })

  it('a version 2 export with a swap imports as the same days', () => {
    const plan: LegacyWeekPlan = { programWeek: 8, swaps: [['thu', 'fri']] }
    const v2 = {
      app: 'BYOB-fit',
      schemaVersion: 2,
      exportedAt: '2026-09-29T10:00:00.000Z',
      programs: [program],
      sessions: [],
      weekPlans: [plan],
      meals: [],
      profile: null,
      settings: null,
      reprograms: [],
      meta: { activeProgramId: program.id },
      goals: null,
      sentLog: [],
    }
    const back = parseBackup(JSON.stringify(v2))
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.backup.schemaVersion).toBe(3)
    for (const date of weekDates(program, 8)) {
      expect(dayForDate(program, back.backup.dayChanges, date).id).toBe(legacyDayForDate(program, plan, date).id)
    }
    expect(back.backup.dayChanges.map((c) => `${c.date}:${c.dayId}`)).toEqual(['2026-10-01:fri', '2026-10-02:thu'])
  })
})

describe('database version 4 wiring', () => {
  const source = readFileSync(new URL('../db/database.ts', import.meta.url), 'utf8')
  const v4 = source.slice(source.indexOf('if (oldVersion < 4)'))
  it('creates dayChanges keyed by date, converts against the active program, then deletes weekPlans', () => {
    expect(source).toContain('export const DB_VERSION = 4')
    expect(v4).toContain("db.createObjectStore('dayChanges', { keyPath: 'date' })")
    expect(v4).toContain("objectStore('weekPlans').getAll()")
    expect(v4).toContain("objectStore('meta').get(ACTIVE_PROGRAM_KEY)")
    expect(v4).toContain('dayChangesFromWeekPlans(program, plans')
    expect(v4.indexOf("put(change)")).toBeLessThan(v4.indexOf("deleteObjectStore('weekPlans'"))
  })
  it('nothing else reads week plans', () => {
    const index = readFileSync(new URL('../db/index.ts', import.meta.url), 'utf8')
    expect(index).not.toMatch(/weekPlans|WeekPlan/)
  })
})
