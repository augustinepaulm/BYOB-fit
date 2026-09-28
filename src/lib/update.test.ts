import { describe, expect, it } from 'vitest'

import sample from '../../public/sample-program.json'
import type { Item, Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { findItem } from './builder.ts'
import type { Proposal } from './reprogram.ts'
import { acceptedOnly, applyReview, reviewLines } from './review.ts'
import { appliesFromText, applyUpdate, dayDate, startedDays } from './update.ts'

// The sample starts Sunday Sep 6, 2026 and runs 8 weeks; week 4 is Sep 27 – Oct 3.
const program = sample as unknown as Program
const item = (p: Program, id: string): Item => findItem(p, id)!.item
const patch = (p: Partial<Proposal>): Proposal => ({ week: 4, overrides: [], add: [], remove: [], notes: '', ...p })

describe('startedDays', () => {
  it('counts days before today and days with a session this week', () => {
    const sessions: Session[] = [{ id: 'x', date: '2026-09-30', dayId: 'wed', programWeek: 4, startedAt: '2026-09-30T08:00:00Z', entries: [] }]
    // Wednesday Sep 30: Sun to Tue are past, Wed has begun.
    expect([...startedDays(program, 4, sessions, '2026-09-30')].sort()).toEqual(['mon', 'sun', 'tue', 'wed'])
  })
})

describe('applyUpdate (D-043 rules 1 and 3)', () => {
  const ctx = { week: 4, started: new Set(['sun', 'mon', 'tue']), history: new Set(['s006', 's007']) }

  it('mid-week: a started day is keyed next week, an unstarted day this week', () => {
    const { program: next, keys } = applyUpdate(
      program,
      patch({
        overrides: [
          { itemId: 's008', fields: { sets: 4 }, reason: 'Mon, started' },
          { itemId: 's020', fields: { repMax: 15 }, reason: 'Wed, not started' },
        ],
      }),
      ctx,
    )
    expect(keys).toEqual({ s008: 5, s020: 4 })
    expect(item(next, 's008').byWeek).toEqual({ '5': { sets: 4 } })
    expect(item(next, 's020').byWeek).toEqual({ '4': { repMax: 15 } })
    // The base items themselves are unchanged.
    expect(item(next, 's008').sets).toBe(item(program, 's008').sets)
  })

  it('keeps an existing override for the same week and adds to it', () => {
    const { program: next } = applyUpdate(program, patch({ week: 5, overrides: [{ itemId: 's019', fields: { restSec: 200 }, reason: 'r' }] }), { ...ctx, week: 5, started: new Set() })
    expect(item(next, 's019').byWeek).toEqual({ '5': { sets: 5, restSec: 200 } })
  })

  it('removing an item with history retires it from the day the change applies', () => {
    const { program: next } = applyUpdate(program, patch({ remove: [{ itemId: 's006', reason: 'r' }] }), ctx)
    // Monday is started, so the change applies next Monday.
    expect(item(next, 's006').retiredFrom).toBe(dayDate(program, 'mon', 5))
    expect(item(next, 's006').retiredFrom).toBe('2026-10-05')
  })

  it('removing an item without history deletes it', () => {
    const { program: next } = applyUpdate(program, patch({ remove: [{ itemId: 's021', reason: 'r' }] }), ctx)
    expect(findItem(next, 's021')).toBeNull()
  })

  it('a swap of an item with history retires it and adds a new item after it', () => {
    const { program: next, keys } = applyUpdate(program, patch({ overrides: [{ itemId: 's007', fields: { exerciseId: 'seated-db-ohp', sets: 2 }, reason: 'r' }] }), ctx)
    const items = findItem(next, 's007')!.day.sections.flatMap((s) => s.items)
    const at = items.findIndex((i) => i.id === 's007')
    expect(items[at].retiredFrom).toBe('2026-10-05')
    expect(items[at + 1]).toMatchObject({ exerciseId: 'seated-db-ohp', sets: 2, type: 'load_reps' })
    expect(keys[items[at + 1].id]).toBe(5)
  })

  it('on the last day of the program, started-day changes fall past the end and are left out', () => {
    const lastWeek = program.programWeeks
    const endCtx = { week: lastWeek, started: new Set(['sun', 'mon', 'tue', 'wed', 'thu', 'fri']), history: new Set(['s006']) }
    const { program: next, keys, skipped } = applyUpdate(
      program,
      patch({
        week: lastWeek,
        overrides: [
          { itemId: 's008', fields: { sets: 5 }, reason: 'Mon, started' },
          { itemId: 's040', fields: { holdSec: 40 }, reason: 'Sat, today' },
        ],
        remove: [{ itemId: 's006', reason: 'r' }],
      }),
      endCtx,
    )
    expect(skipped.sort()).toEqual(['s006', 's008'])
    expect(item(next, 's008').byWeek).toBeUndefined()
    expect(item(next, 's006').retiredFrom).toBeUndefined()
    expect(keys).toEqual({ s040: lastWeek })
  })

  it('says when changes apply (frame 4f)', () => {
    const text = appliesFromText(
      program,
      patch({ overrides: [{ itemId: 's008', fields: { sets: 4 }, reason: 'r' }] }),
      { ...ctx, started: new Set(['sun', 'mon', 'tue', 'wed']) },
    )
    expect(text).toBe('Applies from Thursday. Monday picks them up on Monday.')
  })
})

describe('applyReview (D-043 rule 2)', () => {
  const ctx = { history: new Set(['s006']), today: '2026-09-28', loggedToday: new Set<string>() }
  const proposal = patch({
    overrides: [
      { itemId: 's008', fields: { sets: 4 }, reason: 'a' },
      { itemId: 's006', fields: { exerciseId: 'incline-db-press', restSec: 120 }, reason: 'b' },
    ],
    add: [{ dayId: 'wed', sectionId: program.days.find((d) => d.id === 'wed')!.sections.find((s) => s.kind === 'main')!.id, afterItemId: null, item: { id: 'r-new', exerciseId: 'leg-press', type: 'load_reps', sets: 3 }, reason: 'c' }],
    remove: [{ itemId: 's021', reason: 'd' }],
  })

  it('lists every line and keeps only accepted ones', () => {
    expect(reviewLines(proposal).map((l) => l.key)).toEqual(['o0', 'o1', 'a0', 'r0'])
    const cut = acceptedOnly(proposal, new Set(['o0', 'a0']))
    expect([cut.overrides.length, cut.add.length, cut.remove.length]).toEqual([1, 1, 0])
  })

  it('edits the base program; a swap with history retires and continues on a new item', () => {
    const next = applyReview(program, proposal, ctx)
    expect(item(next, 's008').sets).toBe(4)
    expect(item(next, 's008').byWeek).toBeUndefined()
    const items = findItem(next, 's006')!.day.sections.flatMap((s) => s.items)
    const at = items.findIndex((i) => i.id === 's006')
    expect(items[at].retiredFrom).toBe('2026-09-28')
    expect(items[at + 1]).toMatchObject({ exerciseId: 'incline-db-press', restSec: 120 })
    expect(findItem(next, 'r-new')?.day.id).toBe('wed')
    expect(findItem(next, 's021')).toBeNull()
  })
})

describe('changeText (frames 4c, 4f)', () => {
  it('reads a prescription change and a rest change as the frames do', async () => {
    const { changeText } = await import('./review.ts')
    const bench = item(program, 's006')
    expect(changeText(program, bench, { sets: 3 }, 4)).toEqual({ name: 'Barbell bench press', from: '4 × 6 to 8', to: '3 × 6 to 8' })
    expect(changeText(program, bench, { restSec: 120 }, 4)).toEqual({ name: 'Barbell bench press', from: 'rest 180 s', to: 'rest 120 s' })
    expect(changeText(program, bench, { exerciseId: 'incline-db-press' }, 4).to).toBe('Incline dumbbell press')
  })
})
