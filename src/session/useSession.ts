// The live session for one (date, dayId). Every mutator writes to IndexedDB
// before it updates React state, so a killed tab loses nothing (task 6).

import { useCallback, useEffect, useRef, useState } from 'react'

import { getSessionByDateAndDay, saveSession } from '../db/index.ts'
import { sessionIdFor, sessionToEnd } from '../lib/session.ts'
import type { ItemFields } from '../types/program.ts'
import type { Entry, FeltOff, Session, SetLog } from '../types/stores.ts'

export interface SessionTarget {
  date: string
  dayId: string
  programWeek: number
  swapped: boolean
}

export interface SessionApi {
  session: Session | null
  loading: boolean
  start: () => Promise<void>
  writeSet: (
    itemId: string,
    exerciseId: string,
    set: SetLog | null,
  ) => Promise<void>
  setChecked: (
    itemId: string,
    exerciseId: string,
    checked: boolean,
  ) => Promise<void>
  setNote: (itemId: string, exerciseId: string, note: string) => Promise<void>
  chooseExercise: (itemId: string, exerciseId: string) => Promise<void>
  /** D-048: store how an exercise felt; Discomfort also marks it skipped. */
  setFeltOff: (itemId: string, exerciseId: string, flag: FeltOff | null) => Promise<void>
  finish: () => Promise<void>
  /** D-075 rule 3: mark the stored session ended now; never creates one, never moves an end time. */
  end: () => Promise<void>
  reload: () => Promise<void>
  /** D-065 rule 1: today's order, stored when the user moves an item. */
  setOrder: (order: { itemId: string; sectionId: string }[]) => Promise<void>
  /** D-065 rule 5: add (+1) or remove (-1) an added set; creates the entry if needed. */
  changeAddedSets: (itemId: string, exerciseId: string, delta: 1 | -1) => Promise<void>
  /** D-069 rule 7: an exercise added today, with today's order, in one write. */
  addEntry: (entry: Entry, order: { itemId: string; sectionId: string }[]) => Promise<void>
  /** D-069 rule 8: a swap logged with its own prescription. */
  changeExercise: (itemId: string, exerciseId: string, fields: ItemFields) => Promise<void>
}

function blank(target: SessionTarget): Session {
  return {
    id: sessionIdFor(target.date, target.dayId),
    date: target.date,
    dayId: target.dayId,
    programWeek: target.programWeek,
    startedAt: new Date().toISOString(),
    swapped: target.swapped,
    entries: [],
  }
}

function withEntry(
  session: Session,
  itemId: string,
  exerciseId: string,
  mutate: (entry: Entry) => Entry,
): Session {
  const entries = [...session.entries]
  const at = entries.findIndex((entry) => entry.itemId === itemId)
  const base: Entry =
    at >= 0 ? entries[at] : { itemId, exerciseId, sets: [] }
  const next = mutate(base)
  if (at >= 0) entries[at] = next
  else entries.push(next)
  return { ...session, entries }
}

export function useSession(target: SessionTarget | null): SessionApi {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // React state is a render-time snapshot, so several writes inside one handler
  // would all start from the same stale session and overwrite each other. The
  // ref is the authoritative copy every mutator reads and updates.
  const sessionRef = useRef<Session | null>(null)

  const key = target ? `${target.date}__${target.dayId}` : null

  const read = useCallback(async () => {
    if (!target) return null
    return (await getSessionByDateAndDay(target.date, target.dayId)) ?? null
    // The target object is rebuilt every render; its identity is the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    let live = true
    // A different (date, dayId) must not inherit the previous session.
    sessionRef.current = null
    void read().then((found) => {
      if (!live) return
      sessionRef.current = found
      setSession(found)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [read])

  const reload = useCallback(async () => {
    const found = await read()
    sessionRef.current = found
    setSession(found)
    setLoading(false)
  }, [read])

  /** Write through: save first, then publish to React. */
  const commit = useCallback(async (next: Session) => {
    sessionRef.current = next
    await saveSession(next)
    setSession(next)
  }, [])

  const ensure = useCallback(async (): Promise<Session> => {
    if (sessionRef.current) return sessionRef.current
    if (!target) throw new Error('no session target')
    const existing = await read()
    if (existing) {
      sessionRef.current = existing
      return existing
    }
    return blank(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, read])

  const start = useCallback(async () => {
    const current = await ensure()
    await commit(
      current.startedAt
        ? current
        : { ...current, startedAt: new Date().toISOString() },
    )
  }, [ensure, commit])

  const writeSet = useCallback(
    async (itemId: string, exerciseId: string, set: SetLog | null) => {
      const current = await ensure()
      await commit(
        withEntry(current, itemId, exerciseId, (entry) => {
          if (!set) return entry
          const sets = entry.sets.filter(
            (existing) =>
              !(
                existing.n === set.n &&
                (existing.side ?? undefined) === (set.side ?? undefined)
              ),
          )
          sets.push(set)
          sets.sort((a, b) =>
            a.n === b.n
              ? (a.side ?? '').localeCompare(b.side ?? '')
              : a.n - b.n,
          )
          return { ...entry, sets }
        }),
      )
    },
    [ensure, commit],
  )

  const setChecked = useCallback(
    async (itemId: string, exerciseId: string, checked: boolean) => {
      const current = await ensure()
      await commit(
        withEntry(current, itemId, exerciseId, (entry) => ({
          ...entry,
          checked,
        })),
      )
    },
    [ensure, commit],
  )

  const setNote = useCallback(
    async (itemId: string, exerciseId: string, note: string) => {
      const current = await ensure()
      await commit(
        withEntry(current, itemId, exerciseId, (entry) => ({ ...entry, note })),
      )
    },
    [ensure, commit],
  )

  const chooseExercise = useCallback(
    async (itemId: string, exerciseId: string) => {
      const current = await ensure()
      await commit(
        withEntry(current, itemId, exerciseId, (entry) => ({
          ...entry,
          exerciseId,
        })),
      )
    },
    [ensure, commit],
  )

  const setFeltOff = useCallback(
    async (itemId: string, exerciseId: string, flag: FeltOff | null) => {
      const current = await ensure()
      await commit(
        withEntry(current, itemId, exerciseId, (entry) => {
          const next: Entry = { ...entry }
          delete next.feltOff
          delete next.skipped
          if (flag) next.feltOff = flag
          if (flag === 'discomfort') next.skipped = true
          return next
        }),
      )
    },
    [ensure, commit],
  )

  const setOrder = useCallback(
    async (order: { itemId: string; sectionId: string }[]) => {
      const current = await ensure()
      await commit({ ...current, order })
    },
    [ensure, commit],
  )

  const changeAddedSets = useCallback(
    async (itemId: string, exerciseId: string, delta: 1 | -1) => {
      const current = await ensure()
      await commit(
        withEntry(current, itemId, exerciseId, (entry) => {
          const next: Entry = { ...entry }
          const count = Math.max(0, (entry.addedSets ?? 0) + delta)
          if (count > 0) next.addedSets = count
          else delete next.addedSets
          return next
        }),
      )
    },
    [ensure, commit],
  )

  const addEntry = useCallback(
    async (entry: Entry, order: { itemId: string; sectionId: string }[]) => {
      const current = await ensure()
      await commit({ ...current, entries: [...current.entries.filter((e) => e.itemId !== entry.itemId), entry], order })
    },
    [ensure, commit],
  )

  const changeExercise = useCallback(
    async (itemId: string, exerciseId: string, fields: ItemFields) => {
      const current = await ensure()
      await commit(withEntry(current, itemId, exerciseId, (entry) => ({ ...entry, exerciseId, fields, changed: true })))
    },
    [ensure, commit],
  )

  const finish = useCallback(async () => {
    const current = await ensure()
    // D-075 rule 3: an end time set by end() stays.
    await commit(current.endedAt ? current : { ...current, endedAt: new Date().toISOString() })
  }, [ensure, commit])

  const end = useCallback(async () => {
    const next = sessionToEnd(sessionRef.current, new Date())
    if (next) await commit(next)
  }, [commit])

  return {
    session,
    loading,
    start,
    writeSet,
    setChecked,
    setNote,
    chooseExercise,
    setFeltOff,
    finish,
    end,
    reload,
    setOrder,
    changeAddedSets,
    addEntry,
    changeExercise,
  }
}
