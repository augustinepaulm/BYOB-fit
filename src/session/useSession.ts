// The live session for one (date, dayId). Every mutator writes to IndexedDB
// before it updates React state, so a killed tab loses nothing (task 6).

import { useCallback, useEffect, useRef, useState } from 'react'

import { getSessionByDateAndDay, saveSession } from '../db/index.ts'
import { sessionIdFor } from '../lib/session.ts'
import type { Entry, Session, SetLog } from '../types/stores.ts'

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
  finish: () => Promise<void>
  reload: () => Promise<void>
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

  const finish = useCallback(async () => {
    const current = await ensure()
    await commit({ ...current, endedAt: new Date().toISOString() })
  }, [ensure, commit])

  return {
    session,
    loading,
    start,
    writeSet,
    setChecked,
    setNote,
    chooseExercise,
    finish,
    reload,
  }
}
