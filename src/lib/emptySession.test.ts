/// <reference types="node" />
// EXEC-13-rework commit B, task 7 (D-086): a session that would end with no
// confirmed set and no checked item is deleted instead, on every path.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { Session } from '../types/stores.ts'
import { endOutcome, finishOutcome, isEmptySession } from './session.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const NOW = new Date('2026-10-05T10:00:00.000Z')
const open: Session = { id: '2026-10-05__mon', date: '2026-10-05', dayId: 'mon', programWeek: 6, startedAt: '2026-10-05T09:00:00.000Z', entries: [] }
const oneSet: Session = { ...open, entries: [{ itemId: 'bench', exerciseId: 'bench', sets: [{ n: 1, weight: 60, reps: 8 }] }] }
const oneCheck: Session = { ...open, entries: [{ itemId: 'warm', exerciseId: 'bike', sets: [], checked: true }] }

describe('isEmptySession (D-086 rule 1)', () => {
  it('no entries is empty', () => expect(isEmptySession(open)).toBe(true))
  it('a note, a felt-off flag, a Discomfort skip or an unread raw set is still empty', () => {
    expect(
      isEmptySession({
        ...open,
        entries: [
          { itemId: 'a', exerciseId: 'a', sets: [{ n: 1, raw: 'sixty' }], note: 'sore', feltOff: 'discomfort', skipped: true },
          { itemId: 'b', exerciseId: 'b', sets: [], checked: false, addedSets: 1 },
        ],
      }),
    ).toBe(true)
  })
  it('one confirmed set is not empty', () => expect(isEmptySession(oneSet)).toBe(false))
  it('one checked item is not empty', () => expect(isEmptySession(oneCheck)).toBe(false))
})

describe('the four summary paths: useSession.end (D-086 rule 1)', () => {
  it('an open empty session is deleted', () => {
    expect(endOutcome(open, NOW)).toEqual({ kind: 'delete', session: { ...open, endedAt: NOW.toISOString() } })
  })
  it('a session with one set still ends normally', () => {
    expect(endOutcome(oneSet, NOW)).toEqual({ kind: 'end', session: { ...oneSet, endedAt: NOW.toISOString() } })
  })
  it('a session with one checked item still ends normally', () => {
    expect(endOutcome(oneCheck, NOW).kind).toBe('end')
  })
  it('nothing stored or already ended: nothing happens', () => {
    expect(endOutcome(null, NOW)).toEqual({ kind: 'none' })
    expect(endOutcome({ ...oneSet, endedAt: '2026-10-05T09:30:00.000Z' }, NOW)).toEqual({ kind: 'none' })
  })
  it('the hook deletes on a delete outcome and clears the kept deck state', () => {
    const hook = read('../session/useSession.ts')
    expect(hook).toContain('await settle(endOutcome(sessionRef.current, new Date()))')
    expect(hook).toContain("if (outcome.kind === 'delete') return discard(outcome.session)")
    const discard = hook.slice(hook.indexOf('const discard = useCallback'), hook.indexOf('const settle = useCallback'))
    expect(discard).toContain('await deleteSession(current.id)')
    expect(discard).toContain('await clearDeckState(current.id)')
    expect(discard).toContain('setDiscarded(true)')
  })
})

describe('finish and a mid-workout Change (D-086 rule 1)', () => {
  it('an open empty session is deleted', () => {
    expect(finishOutcome(open, NOW)).toEqual({ kind: 'delete', session: open })
  })
  it('a session with one set ends normally', () => {
    expect(finishOutcome(oneSet, NOW)).toEqual({ kind: 'end', session: { ...oneSet, endedAt: NOW.toISOString() } })
  })
  it('nothing stored creates nothing', () => {
    expect(finishOutcome(undefined, NOW)).toEqual({ kind: 'none' })
  })
  it('an end time already set stays', () => {
    const ended = { ...oneSet, endedAt: '2026-10-05T09:30:00.000Z' }
    expect(finishOutcome(ended, NOW)).toEqual({ kind: 'end', session: ended })
  })
  it('finish no longer creates a blank session through ensure()', () => {
    const hook = read('../session/useSession.ts')
    const finish = hook.slice(hook.indexOf('const finish = useCallback'), hook.indexOf('const end = useCallback'))
    expect(finish).toContain('finishOutcome(sessionRef.current ?? (await read()), new Date())')
    expect(finish).not.toContain('ensure')
  })
  it('the deck’s Change ends today’s session through finish()', () => {
    const deck = read('../screens/DeckScreen.tsx')
    const change = deck.slice(deck.indexOf('{changingDay && ('), deck.indexOf("{sheet === 'felt' && (", deck.indexOf('{changingDay && (')))
    expect(change).toContain('if (api.session) await api.finish()')
  })
})

describe('the summary after a discard (D-086 rule 2)', () => {
  const deck = read('../screens/DeckScreen.tsx')
  const discarded = deck.slice(deck.indexOf("if (phase === 'summary' && (api.discarded || !api.session)) {"), deck.indexOf("if (phase === 'summary') {", deck.indexOf('api.discarded')))
  it('reads "Nothing was logged"', () => {
    expect(discarded).toContain('Nothing was logged')
  })
  it('its Done returns to Today', () => {
    expect(discarded).toMatch(/onClick=\{\(\) => navigate\('\/', \{ replace: true \}\)\}>\s*Done\s*<\/button>/)
  })
})
