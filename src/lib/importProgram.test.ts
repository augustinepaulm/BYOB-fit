import { describe, expect, it } from 'vitest'

import sample from '../../public/sample-program.json'
import type { Day, Program } from '../types/program.ts'
import { importProgram, importProgramText } from './importProgram.ts'

function day(order: number): Day {
  return { id: `d${order}`, order, name: `Day ${order}`, sections: [] }
}

/** A minimal program that satisfies the schema, with startDate swappable. */
function programWith(startDate: string): Program {
  return {
    schemaVersion: 1,
    id: 'test',
    name: 'Test',
    weekStartsOn: 'sunday',
    programWeeks: 8,
    startDate,
    exercises: { squat: { name: 'Back squat', howTo: 'Squat down, stand up.' } },
    days: [0, 1, 2, 3, 4, 5, 6].map(day),
  }
}

describe('startDate must be a Sunday', () => {
  it('accepts a Sunday', () => {
    // Aug 9 2026 is a Sunday.
    const result = importProgram(programWith('2026-08-09'))
    expect(result.ok).toBe(true)
  })

  it('rejects a Monday and names the weekday it found', () => {
    // Aug 10 2026 is a Monday — the date the first seed file carried.
    const result = importProgram(programWith('2026-08-10'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain(
      '/startDate: must be a Sunday, but 2026-08-10 is a Monday',
    )
  })

  it('names each other weekday correctly', () => {
    const cases: [string, string][] = [
      ['2026-08-11', 'Tuesday'],
      ['2026-08-12', 'Wednesday'],
      ['2026-08-13', 'Thursday'],
      ['2026-08-14', 'Friday'],
      ['2026-08-15', 'Saturday'],
    ]
    for (const [date, weekday] of cases) {
      const result = importProgram(programWith(date))
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.errors[0]).toBe(
        `/startDate: must be a Sunday, but ${date} is a ${weekday}`,
      )
    }
  })
})

describe('schema and reference validation', () => {
  it('reports a missing required property with its path', () => {
    const bad = { ...programWith('2026-08-09') } as Record<string, unknown>
    delete bad.name
    const result = importProgram(bad)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('/: missing required property "name"')
  })

  it('reports an unknown exercise reference with its path', () => {
    const program = programWith('2026-08-09')
    program.days[1].sections = [
      {
        id: 's1',
        kind: 'main',
        title: 'Main',
        items: [{ id: 'i1', exerciseId: 'missing', type: 'load_reps' }],
      },
    ]
    const result = importProgram(program)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain(
      '/days/1/sections/0/items/0/exerciseId: no exercise with id "missing"',
    )
  })

  it('reports an unknown reference inside byWeek', () => {
    const program = programWith('2026-08-09')
    program.days[1].sections = [
      {
        id: 's1',
        kind: 'main',
        title: 'Main',
        items: [
          {
            id: 'i1',
            exerciseId: 'squat',
            type: 'load_reps',
            byWeek: { '5': { exerciseId: 'ghost' } },
          },
        ],
      },
    ]
    const result = importProgram(program)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain(
      '/days/1/sections/0/items/0/byWeek/5/exerciseId: no exercise with id "ghost"',
    )
  })

  it('reports unparseable JSON rather than throwing', () => {
    const result = importProgramText('{ not json')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toMatch(/^\/: file is not valid JSON/)
  })
})

describe('schema version 2 (D-035)', () => {
  it('imports the committed version 1 sample and stores it as version 2', () => {
    expect(sample.schemaVersion).toBe(1)
    const result = importProgramText(JSON.stringify(sample))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.program.schemaVersion).toBe(2)
    expect(result.program.days).toHaveLength(7)
  })

  it('imports a version 2 file using every new field', () => {
    const program = programWith('2026-08-09')
    program.schemaVersion = 2
    program.exercises.squat = {
      name: 'Back squat',
      howTo: 'Squat down, stand up.',
      muscles: ['legs', 'glutes'],
      equipment: 'barbell',
      level: 'intermediate',
      demo: 'demos/back-squat.webp',
    }
    program.days[1].sections = [
      {
        id: 's1',
        kind: 'main',
        title: 'Main',
        items: [
          { id: 'i1', exerciseId: 'squat', type: 'load_reps', retiredFrom: '2026-09-20' },
        ],
      },
    ]
    const result = importProgram(program)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.program.schemaVersion).toBe(2)
    expect(result.program.exercises.squat.demo).toBe('demos/back-squat.webp')
    expect(result.program.days[1].sections[0].items[0].retiredFrom).toBe('2026-09-20')
  })

  it('rejects a demo that is an https URL', () => {
    const program = programWith('2026-08-09')
    program.exercises.squat.demo = 'https://example.com/squat.mp4'
    const result = importProgram(program)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join(' ')).toContain('/exercises/squat/demo')
  })

  it('rejects retiredFrom inside a byWeek override', () => {
    const program = programWith('2026-08-09')
    program.days[1].sections = [
      {
        id: 's1',
        kind: 'main',
        title: 'Main',
        items: [
          {
            id: 'i1',
            exerciseId: 'squat',
            type: 'load_reps',
            byWeek: { '3': { retiredFrom: '2026-09-01' } as never },
          },
        ],
      },
    ]
    const result = importProgram(program)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toMatch(
      /^\/days\/1\/sections\/0\/items\/0\/byWeek\/3\/retiredFrom: /,
    )
  })
})
