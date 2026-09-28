import { describe, expect, it } from 'vitest'

import type { Program } from '../types/program.ts'
import { toISODate } from './dates.ts'
import {
  applyUnit,
  firstRunRoute,
  prepareTemplate,
  suggestedTemplate,
  sundayOnOrBefore,
  uniqueProgramId,
} from './onboarding.ts'

describe('firstRunRoute (PLAN 7.5)', () => {
  it('sends a fresh install to onboarding', () => {
    expect(firstRunRoute({ hasProgram: false, onboardingCompletedAt: undefined })).toBe('/welcome')
  })
  it('sends a completed onboarding with no program to import', () => {
    expect(
      firstRunRoute({ hasProgram: false, onboardingCompletedAt: '2026-09-28T09:00:00Z' }),
    ).toBe('/import')
  })
  it('lets an install with a program through, onboarding or not', () => {
    expect(firstRunRoute({ hasProgram: true, onboardingCompletedAt: undefined })).toBe('proceed')
    expect(firstRunRoute({ hasProgram: true, onboardingCompletedAt: '2026-09-28' })).toBe('proceed')
  })
})

describe('sundayOnOrBefore', () => {
  const iso = (d: Date) => toISODate(sundayOnOrBefore(d))
  it('keeps a Sunday', () => {
    expect(iso(new Date(2026, 8, 27, 23, 30))).toBe('2026-09-27')
  })
  it('goes back one day from a Monday', () => {
    expect(iso(new Date(2026, 8, 28, 0, 5))).toBe('2026-09-27')
  })
  it('goes back six days from a Saturday', () => {
    expect(iso(new Date(2026, 9, 3, 12, 0))).toBe('2026-09-27')
  })
  it('crosses a daylight-saving change as calendar days', () => {
    // US clocks go back on Sunday Nov 1, 2026; EU clocks on Sunday Oct 25.
    expect(iso(new Date(2026, 10, 4, 0, 30))).toBe('2026-11-01')
    expect(iso(new Date(2026, 9, 31, 23, 30))).toBe('2026-10-25')
    expect(sundayOnOrBefore(new Date(2026, 10, 4, 0, 30)).getHours()).toBe(0)
  })
})

function program(): Program {
  return {
    schemaVersion: 2,
    id: 'starter-3day-fullbody',
    name: '3-day full body',
    weekStartsOn: 'sunday',
    programWeeks: 8,
    startDate: '2026-01-04',
    exercises: {},
    days: [
      {
        id: 'mon',
        order: 1,
        name: 'Monday',
        sections: [
          {
            id: 's',
            kind: 'main',
            title: 'Main',
            items: [
              { id: 'a', exerciseId: 'squat', type: 'load_reps', sets: 3 },
              { id: 'b', exerciseId: 'plank', type: 'timed_hold', holdSec: 30 },
              { id: 'c', exerciseId: 'row', type: 'load_reps', unit: 'kg' },
              { id: 'd', exerciseId: 'walk', type: 'check' },
            ],
          },
        ],
      },
    ],
  }
}

describe('applyUnit', () => {
  it('sets the unit on load_reps items only, and leaves the input alone', () => {
    const input = program()
    const items = applyUnit(input, 'lb').days[0].sections[0].items
    expect(items.map((i) => i.unit)).toEqual(['lb', undefined, 'lb', undefined])
    expect(input.days[0].sections[0].items[0].unit).toBeUndefined()
  })
})

describe('suggestedTemplate (D-037)', () => {
  it('suggests the 3-day program for New', () => {
    expect(suggestedTemplate('new')).toBe('starter-3day-fullbody.json')
  })
  it('suggests the 4-day program for Experienced', () => {
    expect(suggestedTemplate('experienced')).toBe('starter-4day-upper-lower.json')
  })
})

describe('uniqueProgramId', () => {
  it('keeps a free id', () => {
    expect(uniqueProgramId('p', ['q'])).toBe('p')
  })
  it('appends -2, then -3', () => {
    expect(uniqueProgramId('p', ['p'])).toBe('p-2')
    expect(uniqueProgramId('p', ['p', 'p-2'])).toBe('p-3')
  })
})

describe('prepareTemplate', () => {
  it('dates, units and de-duplicates a template', () => {
    const ready = prepareTemplate(program(), new Date(2026, 8, 30), 'lb', [
      'starter-3day-fullbody',
    ])
    expect(ready.startDate).toBe('2026-09-27')
    expect(ready.id).toBe('starter-3day-fullbody-2')
    expect(ready.schemaVersion).toBe(2)
    expect(ready.days[0].sections[0].items[0].unit).toBe('lb')
  })
})
