import { describe, expect, it } from 'vitest'

import type { Day, Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import {
  applyProposal,
  compactSessions,
  findItem,
  validateProposal,
} from './reprogram.ts'

function day(id: string, order: number, extra: Partial<Day> = {}): Day {
  return { id, order, name: id, sections: [], ...extra }
}

function baseProgram(): Program {
  return {
    schemaVersion: 1,
    id: 'p',
    name: 'P',
    weekStartsOn: 'sunday',
    programWeeks: 12,
    startDate: '2026-08-09',
    exercises: {
      bench: { name: 'Bench', howTo: 'Press.' },
      fly: { name: 'Fly', howTo: 'Fly.' },
    },
    days: [
      day('sun', 0),
      day('mon', 1, {
        sections: [
          {
            id: 'main',
            kind: 'main',
            title: 'Main',
            items: [
              { id: 'i1', exerciseId: 'bench', type: 'load_reps', sets: 4, repMin: 6 },
              { id: 'i2', exerciseId: 'fly', type: 'load_reps', sets: 3, repMin: 12 },
            ],
          },
        ],
      }),
      day('tue', 2),
      day('wed', 3),
      day('thu', 4),
      day('fri', 5),
      day('sat', 6),
    ],
  }
}

const good = {
  week: 7,
  overrides: [{ itemId: 'i1', fields: { sets: 5 }, reason: 'all sets at the top of the range' }],
  add: [],
  remove: [],
  notes: 'Small step up.',
}

describe('validateProposal', () => {
  it('accepts a well-formed proposal', () => {
    const result = validateProposal(good, baseProgram(), 7)
    expect(result.ok).toBe(true)
  })

  it('rejects the wrong target week', () => {
    const result = validateProposal(good, baseProgram(), 8)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('/week')
  })

  it('rejects an unknown itemId', () => {
    const result = validateProposal(
      { ...good, overrides: [{ itemId: 'nope', fields: { sets: 5 }, reason: 'r' }] },
      baseProgram(),
      7,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('no item with id "nope"')
  })

  it('rejects fields the schema does not allow', () => {
    const result = validateProposal(
      { ...good, overrides: [{ itemId: 'i1', fields: { sets: 'five' }, reason: 'r' }] },
      baseProgram(),
      7,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown exerciseId inside fields', () => {
    const result = validateProposal(
      { ...good, overrides: [{ itemId: 'i1', fields: { exerciseId: 'ghost' }, reason: 'r' }] },
      baseProgram(),
      7,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('no exercise with id "ghost"')
  })

  it('rejects an addition naming an unknown exercise with no exercise object', () => {
    const result = validateProposal(
      {
        ...good,
        add: [
          {
            dayId: 'mon',
            sectionId: 'main',
            afterItemId: 'i2',
            item: { id: 'i3', exerciseId: 'newthing', type: 'load_reps', sets: 3, repMin: 10 },
            reason: 'r',
          },
        ],
      },
      baseProgram(),
      7,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join(' ')).toContain('no "exercise" object was supplied')
  })

  it('accepts an addition that carries its own exercise', () => {
    const result = validateProposal(
      {
        ...good,
        add: [
          {
            dayId: 'mon',
            sectionId: 'main',
            afterItemId: 'i2',
            item: { id: 'i3', exerciseId: 'newthing', type: 'load_reps', sets: 3, repMin: 10 },
            exercise: { name: 'New thing', howTo: 'Do it.' },
            reason: 'r',
          },
        ],
      },
      baseProgram(),
      7,
    )
    expect(result.ok).toBe(true)
  })

  it('rejects an addition into a section the day does not have', () => {
    const result = validateProposal(
      {
        ...good,
        add: [
          {
            dayId: 'mon',
            sectionId: 'abs',
            afterItemId: null,
            item: { id: 'i3', exerciseId: 'fly', type: 'load_reps' },
            reason: 'r',
          },
        ],
      },
      baseProgram(),
      7,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects a removal of an unknown item', () => {
    const result = validateProposal(
      { ...good, remove: [{ itemId: 'nope', reason: 'r' }] },
      baseProgram(),
      7,
    )
    expect(result.ok).toBe(false)
  })
})

describe('applyProposal', () => {
  it('writes an override as byWeek for the target week and leaves the input alone', () => {
    const program = baseProgram()
    const next = applyProposal(program, good)
    expect(findItem(next, 'i1')?.item.byWeek).toEqual({ '7': { sets: 5 } })
    expect(findItem(program, 'i1')?.item.byWeek).toBeUndefined()
  })

  it('merges over an existing override for the same week', () => {
    const program = baseProgram()
    const item = findItem(program, 'i1')!.item
    item.byWeek = { '7': { repMin: 5, cue: 'keep' } }
    const next = applyProposal(program, good)
    expect(findItem(next, 'i1')?.item.byWeek?.['7']).toEqual({
      repMin: 5,
      cue: 'keep',
      sets: 5,
    })
  })

  it('inserts an addition after the named item and registers a new exercise', () => {
    const next = applyProposal(baseProgram(), {
      week: 7,
      overrides: [],
      add: [
        {
          dayId: 'mon',
          sectionId: 'main',
          afterItemId: 'i1',
          item: { id: 'i3', exerciseId: 'newthing', type: 'load_reps', sets: 3, repMin: 10 },
          exercise: { name: 'New thing', howTo: 'Do it.' },
          reason: 'r',
        },
      ],
      remove: [],
      notes: '',
    })
    const items = next.days[1].sections[0].items.map((item) => item.id)
    expect(items).toEqual(['i1', 'i3', 'i2'])
    expect(next.exercises.newthing.name).toBe('New thing')
  })

  it('inserts at the front when afterItemId is null', () => {
    const next = applyProposal(baseProgram(), {
      week: 7,
      overrides: [],
      add: [
        {
          dayId: 'mon',
          sectionId: 'main',
          afterItemId: null,
          item: { id: 'i0', exerciseId: 'fly', type: 'load_reps' },
          reason: 'r',
        },
      ],
      remove: [],
      notes: '',
    })
    expect(next.days[1].sections[0].items[0].id).toBe('i0')
  })

  it('removes an item', () => {
    const next = applyProposal(baseProgram(), {
      week: 7,
      overrides: [],
      add: [],
      remove: [{ itemId: 'i2', reason: 'r' }],
      notes: '',
    })
    expect(next.days[1].sections[0].items.map((i) => i.id)).toEqual(['i1'])
  })
})

describe('compactSessions', () => {
  const session: Session = {
    id: 's',
    date: '2026-09-14',
    dayId: 'mon',
    programWeek: 6,
    endedAt: '2026-09-14T10:00:00Z',
    entries: [
      {
        itemId: 'i1',
        exerciseId: 'bench',
        sets: [
          { n: 1, weight: 60, reps: 8 },
          { n: 2, raw: 'sixty two half' },
        ],
        note: 'felt strong',
      },
      { itemId: 'i9', exerciseId: 'walk', sets: [], checked: true },
    ],
  }

  it('keeps only confirmed sets and drops flagged raw text', () => {
    const [compact] = compactSessions([session])
    expect(compact.entries[0].sets).toEqual([{ n: 1, weight: 60, reps: 8 }])
    expect(JSON.stringify(compact)).not.toContain('sixty two half')
  })

  it('keeps notes and checks, and omits empty set lists', () => {
    const [compact] = compactSessions([session])
    expect(compact.entries[0].note).toBe('felt strong')
    expect(compact.entries[1].checked).toBe(true)
    expect(compact.entries[1].sets).toBeUndefined()
  })
})
