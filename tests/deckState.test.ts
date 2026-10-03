// EXEC-13-rework commit B, tasks 6 and 7 (D-077 rule 4, D-086), against a
// real IndexedDB implementation (fake-indexeddb, dev only).
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '../src/types/stores.ts'

type Db = typeof import('../src/db/index.ts')
type Deck = typeof import('../src/session/deckState.ts')

/** A fresh copy of the modules: a new database connection, as when the app reopens. */
async function reopen(): Promise<{ db: Db; deck: Deck }> {
  vi.resetModules()
  return { db: await import('../src/db/index.ts'), deck: await import('../src/session/deckState.ts') }
}

beforeEach(async () => {
  const { db } = await reopen()
  await db.clearAllStores()
})

const id = '2026-10-05__mon'

describe('deck state persists (D-077 rule 4, task 6)', () => {
  it('survives the deck unmounting and mounting again', async () => {
    const { deck } = await reopen()
    const kept = { sessionId: id, restUntil: 1_800_000_000_000, restSec: 150, drafts: { 'bench:2:|w': '62.5' }, position: 1, label: 'Bench press, set 2 next' }
    await deck.writeDeckState(kept)
    // The deck mounts again and reads what it left.
    expect(await deck.readDeckState(id)).toEqual(kept)
  })

  it('survives the app being closed and reopened', async () => {
    const first = await reopen()
    await first.deck.writeDeckState({ sessionId: id, restUntil: 1_800_000_000_000, drafts: { 'bench:1:|r': '8' }, position: 2 })
    const second = await reopen()
    expect(await second.deck.readDeckState(id)).toEqual({ sessionId: id, restUntil: 1_800_000_000_000, drafts: { 'bench:1:|r': '8' }, position: 2 })
  })

  it('is kept per session', async () => {
    const { deck } = await reopen()
    await deck.writeDeckState({ sessionId: id, restUntil: null, drafts: { a: '1' }, position: 0 })
    expect(await deck.readDeckState('2026-10-06__tue')).toBeNull()
  })

  it('is cleared when the session ends', async () => {
    const { deck } = await reopen()
    await deck.writeDeckState({ sessionId: id, restUntil: null, drafts: {}, position: 0 })
    await deck.clearDeckState(id)
    expect(await deck.readDeckState(id)).toBeNull()
  })

  it('lives in meta, keyed by session', async () => {
    const { db, deck } = await reopen()
    await deck.writeDeckState({ sessionId: id, restUntil: null, drafts: {}, position: 3 })
    expect(JSON.parse((await db.getMeta(`deck:${id}`))!)).toMatchObject({ sessionId: id, position: 3 })
  })
})

describe('endOpenSession (D-069 rule 4 with D-086)', () => {
  const open: Session = { id, date: '2026-10-05', dayId: 'mon', programWeek: 6, startedAt: '2026-10-05T09:00:00.000Z', entries: [] }

  it('deletes an open session with nothing in it; the date stays open', async () => {
    const { db } = await reopen()
    await db.saveSession(open)
    expect(await db.endOpenSession('2026-10-05', 'mon')).toBe(true)
    expect(await db.getSession(id)).toBeUndefined()
  })

  it('ends a session with one set as it stands', async () => {
    const { db } = await reopen()
    const logged: Session = { ...open, entries: [{ itemId: 'bench', exerciseId: 'bench', sets: [{ n: 1, weight: 60, reps: 8 }] }] }
    await db.saveSession(logged)
    expect(await db.endOpenSession('2026-10-05', 'mon')).toBe(true)
    const stored = await db.getSession(id)
    expect(stored?.endedAt).toBeDefined()
    expect(stored?.entries).toEqual(logged.entries)
  })

  it('leaves an ended session alone', async () => {
    const { db } = await reopen()
    const ended = { ...open, endedAt: '2026-10-05T09:30:00.000Z' }
    await db.saveSession(ended)
    expect(await db.endOpenSession('2026-10-05', 'mon')).toBe(false)
    expect(await db.getSession(id)).toEqual(ended)
  })

  it('deleteSession removes one session', async () => {
    const { db } = await reopen()
    await db.saveSession(open)
    await db.deleteSession(id)
    expect(await db.listAllSessions()).toEqual([])
  })
})
