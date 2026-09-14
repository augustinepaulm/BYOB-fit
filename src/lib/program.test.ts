import { describe, expect, it } from 'vitest'

import type { Day, Item, Program, Section } from '../types/program.ts'
import type { WeekPlan } from '../types/stores.ts'
import {
  currentWeek,
  dayForDate,
  isLogged,
  resolveItem,
  weekDates,
} from './program.ts'

// Aug 9 2026 is a Sunday; week 6 therefore begins Sun Sep 13 2026.
const START = '2026-08-09'

function day(id: string, order: number, extra: Partial<Day> = {}): Day {
  return { id, order, name: id, sections: [], ...extra }
}

const program: Program = {
  schemaVersion: 1,
  id: 'test',
  name: 'Test program',
  weekStartsOn: 'sunday',
  programWeeks: 12,
  startDate: START,
  exercises: { bench: { name: 'Barbell bench press', howTo: 'Press it.' } },
  days: [
    day('sun', 0),
    day('mon', 1, { swappableWith: 'thu' }),
    day('tue', 2),
    day('wed', 3),
    day('thu', 4, { swappableWith: 'mon' }),
    day('fri', 5),
    day('sat', 6, { rest: true }),
  ],
}

const bench: Item = {
  id: 'i1',
  exerciseId: 'bench',
  type: 'load_reps',
  sets: 4,
  repMin: 6,
  repMax: 8,
  byWeek: {
    '5': { sets: 5, repMin: 5 },
    '9': { repMin: 3, repMax: 5 },
  },
}

describe('currentWeek', () => {
  it('returns week 1 on the start date itself', () => {
    expect(currentWeek(program, new Date(2026, 7, 9))).toBe(1)
  })

  it('keeps the last day of week 1 in week 1', () => {
    expect(currentWeek(program, new Date(2026, 7, 15))).toBe(1)
  })

  it('rolls to week 2 on the next Sunday', () => {
    expect(currentWeek(program, new Date(2026, 7, 16))).toBe(2)
  })

  it('computes a mid-block week', () => {
    expect(currentWeek(program, new Date(2026, 8, 14))).toBe(6)
  })

  it('clamps dates before the start to week 1', () => {
    expect(currentWeek(program, new Date(2026, 6, 1))).toBe(1)
  })

  it('clamps dates past the last week to programWeeks', () => {
    expect(currentWeek(program, new Date(2026, 11, 31))).toBe(12)
  })
})

describe('resolveItem', () => {
  it('leaves the item alone before any override key', () => {
    const r = resolveItem(bench, 4)
    expect(r.sets).toBe(4)
    expect(r.repMin).toBe(6)
    expect(r.repMax).toBe(8)
  })

  it('applies an override on its own key week', () => {
    const r = resolveItem(bench, 5)
    expect(r.sets).toBe(5)
    expect(r.repMin).toBe(5)
    // Untouched fields survive the merge.
    expect(r.repMax).toBe(8)
  })

  it('keeps an override in force after its key week', () => {
    expect(resolveItem(bench, 8).sets).toBe(5)
    expect(resolveItem(bench, 8).repMin).toBe(5)
  })

  it('lets a higher key overwrite the fields it names', () => {
    const r = resolveItem(bench, 10)
    expect(r.repMin).toBe(3)
    expect(r.repMax).toBe(5)
    // D-023: cumulative, so week 5's sets survives week 9, which is silent on it.
    expect(r.sets).toBe(5)
  })

  it('keeps a lower key field a higher key does not mention (walk-jog)', () => {
    // seed/program.json sat/i204: base is off, week 8 turns logging on, and
    // weeks 10 and 12 only refine the cue and minutes.
    const walkJog: Item = {
      id: 'i204',
      exerciseId: 'walk-jog',
      type: 'cardio_block',
      minutes: 24,
      logged: false,
      cue: 'not before week 8',
      byWeek: {
        '8': { logged: true, cue: '1 min jog, 2 min walk, x8' },
        '10': { cue: '2 min jog, 1 min walk, x8' },
        '12': { minutes: 15, cue: 'continuous 15 min' },
      },
    }
    expect(resolveItem(walkJog, 7).logged).toBe(false)
    expect(resolveItem(walkJog, 8).logged).toBe(true)
    // The week 10 and 12 entries are silent on logged, so week 8's true stands.
    expect(resolveItem(walkJog, 10).logged).toBe(true)
    expect(resolveItem(walkJog, 10).cue).toBe('2 min jog, 1 min walk, x8')
    expect(resolveItem(walkJog, 10).minutes).toBe(24)
    expect(resolveItem(walkJog, 12).logged).toBe(true)
    expect(resolveItem(walkJog, 12).minutes).toBe(15)
    // And the section default is not consulted while logged is set.
    expect(isLogged('cardio', resolveItem(walkJog, 12))).toBe(true)
    expect(isLogged('cardio', resolveItem(walkJog, 7))).toBe(false)
  })

  it('drops byWeek from the resolved item but keeps the id', () => {
    const r = resolveItem(bench, 6)
    expect(r.id).toBe('i1')
    expect('byWeek' in r).toBe(false)
  })

  it('can override exerciseId for a staged progression', () => {
    const staged: Item = {
      id: 'i2',
      exerciseId: 'plyo_stage1',
      type: 'bodyweight_reps',
      byWeek: { '7': { exerciseId: 'plyo_stage2' } },
    }
    expect(resolveItem(staged, 6).exerciseId).toBe('plyo_stage1')
    expect(resolveItem(staged, 7).exerciseId).toBe('plyo_stage2')
  })
})

describe('isLogged', () => {
  it('logs main, block and abs', () => {
    expect(isLogged('main', {})).toBe(true)
    expect(isLogged('block', {})).toBe(true)
    expect(isLogged('abs', {})).toBe(true)
  })

  it('logs cardio', () => {
    expect(isLogged('cardio', {})).toBe(true)
  })

  it('checks off warmup, cooldown and daily', () => {
    expect(isLogged('warmup', {})).toBe(false)
    expect(isLogged('cooldown', {})).toBe(false)
    expect(isLogged('daily', {})).toBe(false)
  })

  it('lets the item override the section default both ways', () => {
    expect(isLogged('warmup', { logged: true })).toBe(true)
    expect(isLogged('main', { logged: false })).toBe(false)
  })
})

describe('dayForDate', () => {
  it('picks the day whose order matches the weekday', () => {
    // Mon Sep 14 2026.
    expect(dayForDate(program, null, new Date(2026, 8, 14)).id).toBe('mon')
    // Sun Sep 13 2026.
    expect(dayForDate(program, null, new Date(2026, 8, 13)).id).toBe('sun')
  })

  it('honours a recorded swap in both directions', () => {
    const plan: WeekPlan = { programWeek: 6, swaps: [['thu', 'mon']] }
    expect(dayForDate(program, plan, new Date(2026, 8, 14)).id).toBe('thu')
    expect(dayForDate(program, plan, new Date(2026, 8, 17)).id).toBe('mon')
  })

  it('leaves unswapped days alone when a swap exists', () => {
    const plan: WeekPlan = { programWeek: 6, swaps: [['thu', 'mon']] }
    expect(dayForDate(program, plan, new Date(2026, 8, 15)).id).toBe('tue')
  })
})

describe('weekDates', () => {
  it('returns seven dates starting on the week 1 Sunday', () => {
    const dates = weekDates(program, 1)
    expect(dates).toHaveLength(7)
    expect(dates[0].getDay()).toBe(0)
    expect(dates[0].toDateString()).toBe(new Date(2026, 7, 9).toDateString())
    expect(dates[6].toDateString()).toBe(new Date(2026, 7, 15).toDateString())
  })

  it('offsets by whole weeks', () => {
    const dates = weekDates(program, 6)
    expect(dates[0].toDateString()).toBe(new Date(2026, 8, 13).toDateString())
    expect(dates[6].toDateString()).toBe(new Date(2026, 8, 19).toDateString())
  })
})

describe('section kinds cover the schema enum', () => {
  it('treats every kind in a program the same way twice', () => {
    const sections: Section[] = [
      { id: 's1', kind: 'warmup', title: 'Warm-up', items: [] },
      { id: 's2', kind: 'main', title: 'Main', items: [] },
    ]
    expect(sections.map((s) => isLogged(s.kind, {}))).toEqual([false, true])
  })
})
