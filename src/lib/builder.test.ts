import { describe, expect, it } from 'vitest'

import sample from '../../public/sample-program.json'
import starter3 from '../../public/templates/starter-3day-fullbody.json'
import starter4 from '../../public/templates/starter-4day-upper-lower.json'
import starter5 from '../../public/templates/starter-5day-split.json'
import type { Day, Item, Program } from '../types/program.ts'
import { importProgram } from './importProgram.ts'
import type { Session } from '../types/stores.ts'
import {
  blankProgram,
  exerciseLibrary,
  filterLibrary,
  findItem,
  howToSteps,
  itemErrors,
  itemsLoggedOn,
  itemsWithHistory,
  moveDay,
  newId,
  removeItem,
  reviewChecks,
  roundTrip,
  sessionGroup,
  sessionMinutes,
  setSwappable,
  swapExercise,
  swapInGroup,
  usedIds,
  weekdaysLabel,
  weeksOfHistory,
} from './builder.ts'

const starters = [starter3, starter4, starter5] as unknown as Program[]
const samplePrograms: [string, Program][] = [
  ['sample', sample as unknown as Program],
  ['3-day', starter3 as unknown as Program],
  ['4-day', starter4 as unknown as Program],
  ['5-day', starter5 as unknown as Program],
]

function session(date: string, week: number, itemIds: string[], sets = true): Session {
  return {
    id: `${date}__mon`,
    date,
    dayId: 'mon',
    programWeek: week,
    entries: itemIds.map((itemId) => ({
      itemId,
      exerciseId: 'x',
      sets: sets ? [{ n: 1, weight: 60, reps: 5 }] : [],
    })),
  }
}

function program(): Program {
  return {
    schemaVersion: 2,
    id: 'p',
    name: 'P',
    weekStartsOn: 'sunday',
    programWeeks: 8,
    startDate: '2026-09-27',
    exercises: {
      squat: { name: 'Squat', howTo: 'Squat.', muscles: ['legs'], equipment: 'barbell', level: 'intermediate' },
      press: { name: 'Leg press', howTo: 'Press.', muscles: ['legs'], equipment: 'machine', level: 'beginner' },
    },
    days: [
      {
        id: 'mon',
        order: 1,
        name: 'Monday',
        sections: [
          {
            id: 'main',
            kind: 'main',
            title: 'Main',
            items: [
              { id: 'item-3', exerciseId: 'squat', type: 'load_reps', sets: 3, repMin: 8, repMax: 10, restSec: 120, unit: 'kg', cue: 'Brace.', byWeek: { '4': { exerciseId: 'ghost-ex' } } },
              { id: 'b', exerciseId: 'press', type: 'load_reps', sets: 3 },
            ],
          },
        ],
      },
    ],
  }
}

describe('newId (D-042 rule 2)', () => {
  it('never returns an id the program uses, byWeek exercise ids included', () => {
    const p = program()
    const id = newId(p, 'item')
    expect(id).toBe('item-4')
    expect(usedIds(p).has(id)).toBe(false)
    expect(usedIds(p).has('ghost-ex')).toBe(true)
  })
  it('skips past numbers already used with the prefix', () => {
    const p = program()
    p.days[0].id = 'day-1'
    p.days[0].sections[0].id = 'day-2'
    expect(newId(p, 'day')).toBe('day-3')
    expect(newId(p, 'custom')).toBe('custom-1')
  })
})

describe('history', () => {
  const sessions = [session('2026-09-21', 1, ['item-3']), session('2026-09-28', 2, ['b'], false)]
  it('collects every item id with a session entry', () => {
    expect([...itemsWithHistory(sessions)].sort()).toEqual(['b', 'item-3'])
  })
  it('knows what today logged', () => {
    expect([...itemsLoggedOn([session('2026-09-28', 2, ['item-3'])], '2026-09-28')]).toEqual(['item-3'])
    expect([...itemsLoggedOn(sessions, '2026-09-28')]).toEqual([])
  })
  it('counts weeks of history', () => {
    expect(weeksOfHistory([...sessions, session('2026-09-14', 1, ['item-3'])], 'item-3')).toBe(1)
  })
})

describe('removeItem (D-042 rule 3)', () => {
  it('deletes an item without history', () => {
    const next = removeItem(program(), 'b', new Set(), '2026-09-28', new Set())
    expect(findItem(next, 'b')).toBeNull()
  })
  it('retires an item with history from today', () => {
    const next = removeItem(program(), 'b', new Set(['b']), '2026-09-28', new Set())
    expect(findItem(next, 'b')?.item.retiredFrom).toBe('2026-09-28')
  })
  it('retires from tomorrow when today already logged it', () => {
    const next = removeItem(program(), 'b', new Set(['b']), '2026-09-30', new Set(['b']))
    expect(findItem(next, 'b')?.item.retiredFrom).toBe('2026-10-01')
  })
})

describe('swapExercise (D-042 rule 4)', () => {
  it('edits in place without history', () => {
    const next = swapExercise(program(), 'b', 'squat', new Set(), '2026-09-28', new Set())
    expect(next.days[0].sections[0].items.map((i) => [i.id, i.exerciseId])).toEqual([
      ['item-3', 'squat'],
      ['b', 'squat'],
    ])
  })
  it('retires and inserts a new item right after, same prescription', () => {
    const next = swapExercise(program(), 'item-3', 'press', new Set(['item-3']), '2026-09-28', new Set())
    const items = next.days[0].sections[0].items
    expect(items.map((i) => i.id)).toEqual(['item-3', 'item-4', 'b'])
    expect(items[0]).toMatchObject({ exerciseId: 'squat', retiredFrom: '2026-09-28' })
    expect(items[1]).toEqual({ id: 'item-4', exerciseId: 'press', type: 'load_reps', sets: 3, repMin: 8, repMax: 10, restSec: 120, unit: 'kg' })
  })
})

describe('sessionMinutes reproduces every starter training day', () => {
  for (const starter of starters) {
    for (const day of starter.days.filter((d) => !d.rest)) {
      it(`${starter.id} ${day.id} = ${day.durationMin}`, () => {
        expect(sessionMinutes(day)).toBe(day.durationMin)
      })
    }
  }
  it('covers 12 training days', () => {
    expect(starters.flatMap((s) => s.days.filter((d) => !d.rest))).toHaveLength(12)
  })
  it('applies each term', () => {
    const day: Day = {
      id: 'x', order: 1, name: 'X',
      sections: [{
        id: 's', kind: 'main', title: 'Main', items: [
          { id: 'a', exerciseId: 'e', type: 'cardio_block', minutes: 20 },
          { id: 'b', exerciseId: 'e', type: 'timed_hold', sets: 3, holdSec: 60, perSide: true, restSec: 30 },
          { id: 'c', exerciseId: 'e', type: 'check' },
          { id: 'd', exerciseId: 'e', type: 'check', retiredFrom: '2026-01-01' },
        ],
      }],
    }
    // 20 + 3 × (1 × 2 + 0.5) + 1 + 1 × (40/60 + 1) + 1 = 31.17 → 30
    expect(sessionMinutes(day)).toBe(30)
  })
})

describe('exercise library (D-042 rule 7)', () => {
  const lib = exerciseLibrary(starters, [sample as unknown as Program, program()])
  it('de-duplicates by id, starters first', () => {
    const ids = lib.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('leg-press')
    expect(ids).toContain('bench-press')
  })
  it('filters by muscles, level and equipment', () => {
    const legs = filterLibrary(lib, { sameMusclesAs: ['legs'], beginner: true })
    expect(legs.length).toBeGreaterThan(0)
    expect(legs.every((e) => e.exercise.muscles?.includes('legs') && e.exercise.level === 'beginner')).toBe(true)
    const none = filterLibrary(lib, { noEquipment: true })
    expect(none.every((e) => e.exercise.equipment === 'none')).toBe(true)
  })
  it('search matches name, muscles and equipment (EXEC-11 task 11)', () => {
    const byMuscle = filterLibrary(lib, { query: 'glutes' })
    expect(byMuscle.length).toBeGreaterThan(0)
    expect(byMuscle.every((e) => e.exercise.muscles?.includes('glutes') || e.exercise.name.toLowerCase().includes('glute'))).toBe(true)
    const byEquipment = filterLibrary(lib, { query: 'Machine' })
    expect(byEquipment.some((e) => e.exercise.equipment === 'machine' && !e.exercise.name.toLowerCase().includes('machine'))).toBe(true)
    expect(filterLibrary(lib, { query: 'full body' }).every((e) => e.exercise.muscles?.includes('full_body') || /full body/i.test(e.exercise.name))).toBe(true)
    const both = filterLibrary(lib, { query: 'dumbbell legs' })
    expect(both.length).toBeGreaterThan(0)
    expect(both.every((e) => e.exercise.equipment === 'dumbbell' && e.exercise.muscles?.includes('legs'))).toBe(true)
    expect(filterLibrary(lib, { query: 'zzz' })).toEqual([])
  })
  it('shows exercises without metadata only when no filter is on', () => {
    const bare = lib.filter((e) => !e.exercise.muscles)
    expect(bare.length).toBeGreaterThan(0)
    expect(filterLibrary(lib, {})).toHaveLength(lib.length)
    expect(filterLibrary(lib, { sameMusclesAs: ['legs'] }).some((e) => !e.exercise.muscles)).toBe(false)
    expect(filterLibrary(lib, { query: 'bench' }).map((e) => e.id)).toContain('bench-press')
  })
})

describe('itemErrors (2h)', () => {
  it('names the field that caused the error', () => {
    expect(itemErrors({ type: 'load_reps', repMin: 14, repMax: 12 })).toEqual({ repMax: 'The second number must be higher' })
    expect(itemErrors({ type: 'load_reps', repMin: 12, repMax: 12 })).toEqual({})
    expect(itemErrors({ type: 'timed_hold', sets: 0 })).toMatchObject({ sets: expect.any(String), holdSec: expect.any(String) })
  })
})

describe('reviewChecks (2j)', () => {
  it('passes a starter program', () => {
    expect(reviewChecks(starter3 as unknown as Program).map((c) => c.ok)).toEqual([true, true, true])
  })
  it('names an empty training day', () => {
    const p = blankProgram('b', '2026-09-27')
    const [first] = reviewChecks(p)
    expect(first.ok).toBe(false)
    expect(first.detail).toContain('Sun · Sunday')
  })
  it('names the invalid field', () => {
    const p = program()
    p.days[0].sections[0].items[1] = { id: 'b', exerciseId: 'press', type: 'load_reps', repMin: 14, repMax: 12 }
    const second = reviewChecks(p)[1]
    expect(second.ok).toBe(false)
    expect(second.detail).toBe('Mon · Monday · Leg press: repMax')
  })
  it('fails a schema error the field rules do not cover', () => {
    const p = structuredClone(starter3) as unknown as Program
    p.startDate = '2026-09-28'
    const second = reviewChecks(p)[1]
    expect(second.ok).toBe(false)
    expect(second.detail).toContain('/startDate')
  })
})

describe('roundTrip (D-042 rule 9)', () => {
  for (const [name, p] of samplePrograms) {
    it(`${name} comes back byte-identical`, () => {
      expect(roundTrip(p)).toBe(JSON.stringify(p))
    })
  }
  it('the sample has a byWeek override', () => {
    const items = (sample as unknown as Program).days.flatMap((d) => d.sections.flatMap((s) => s.items))
    expect(items.some((i: Item) => i.byWeek)).toBe(true)
  })
})

describe('days (2f)', () => {
  it('moves content between weekdays; ids stay with content', () => {
    const p = blankProgram('b', '2026-09-27')
    const moved = moveDay(p, 1, 3)
    const byOrder = [...moved.days].sort((a, b) => a.order - b.order).map((d) => d.id)
    expect(byOrder).toEqual(['sun', 'tue', 'wed', 'mon', 'thu', 'fri', 'sat'])
    expect(moved.days.find((d) => d.id === 'mon')?.name).toBe('Monday')
  })
  it('pairs swappable days both ways and undoes old pairs', () => {
    let p = setSwappable(blankProgram('b', '2026-09-27'), 'mon', 'wed')
    expect([p.days[1].swappableWith, p.days[3].swappableWith]).toEqual(['wed', 'mon'])
    p = setSwappable(p, 'mon', 'fri')
    expect([p.days[1].swappableWith, p.days[3].swappableWith, p.days[5].swappableWith]).toEqual(['fri', undefined, 'mon'])
    p = setSwappable(p, 'fri', null)
    expect(p.days.every((d) => d.swappableWith === undefined)).toBe(true)
  })
})

describe('howToSteps (2d)', () => {
  it('splits sentences', () => {
    expect(howToSteps('Sit down. Push up! Done?')).toEqual(['Sit down.', 'Push up!', 'Done?'])
  })
})

describe('starter sessions group by focus (Phase 8 fix)', () => {
  const p = structuredClone(starter3) as unknown as Program
  const mon = p.days.find((d) => d.id === 'mon')!
  const goblet = mon.sections.flatMap((s) => s.items).find((i) => i.exerciseId === 'goblet-squat')!
  const legPress = { id: 'leg-press', exercise: p.exercises['leg-press'] }

  it('groups Monday and Friday (Full body A), never Wednesday', () => {
    expect(sessionGroup(p, 'mon').map((d) => d.id)).toEqual(['mon', 'fri'])
    expect(sessionGroup(p, 'wed').map((d) => d.id)).toEqual(['wed'])
  })

  it('reads "Monday and Friday" in the 2b header', () => {
    expect(weekdaysLabel(sessionGroup(p, 'mon'))).toBe('Monday and Friday')
  })

  it('a swap on Full body A changes Monday and Friday and never Wednesday', () => {
    const next = swapInGroup(p, 'mon', goblet.id, legPress)
    const ids = (dayId: string) => next.days.find((d) => d.id === dayId)!.sections.flatMap((s) => s.items).map((i) => i.exerciseId)
    expect(ids('mon')).toContain('leg-press')
    expect(ids('mon')).not.toContain('goblet-squat')
    expect(ids('fri')).toContain('leg-press')
    expect(ids('fri')).not.toContain('goblet-squat')
    expect(ids('wed')).toEqual(p.days.find((d) => d.id === 'wed')!.sections.flatMap((s) => s.items).map((i) => i.exerciseId))
  })

  it('falls back to the name when a day has no focus', () => {
    const q = blankProgram('b', '2026-09-27')
    q.days[1].name = 'Push'
    q.days[4].name = 'Push'
    expect(sessionGroup(q, 'mon').map((d) => d.id)).toEqual(['mon', 'thu'])
  })
})

describe('round trip with an alternate exercise', () => {
  it('a test copy of the sample with alternateExerciseId comes back byte-identical', () => {
    const copy = structuredClone(sample) as unknown as Program
    const item = copy.days.find((d) => d.id === 'mon')!.sections.find((s) => s.kind === 'main')!.items[0]
    item.alternateExerciseId = 'incline-db-press'
    expect(roundTrip(copy)).toBe(JSON.stringify(copy))
    expect(JSON.stringify(sample)).not.toContain('alternateExerciseId')
  })
})

describe('progression is carried through untouched (D-047)', () => {
  it('a program whose items carry progression round-trips byte-identical', () => {
    const copy = structuredClone(sample) as unknown as Program
    const main = copy.days.find((d) => d.id === 'mon')!.sections.find((s) => s.kind === 'main')!
    main.items[0].progression = { sessions: 3, percent: 2, step: 1 }
    main.items[1].progression = { step: 2.5 }
    expect(roundTrip(copy)).toBe(JSON.stringify(copy))
    expect(importProgram(copy).ok).toBe(true)
  })

  it('changing an item type in the builder keeps progression', async () => {
    const { withType } = await import('./builder.ts')
    const item: Item = { id: 'x', exerciseId: 'e', type: 'load_reps', sets: 3, progression: { sessions: 3 } }
    expect(withType(item, 'bodyweight_reps').progression).toEqual({ sessions: 3 })
  })
})
