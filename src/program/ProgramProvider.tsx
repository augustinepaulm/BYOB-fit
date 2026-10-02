import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { deleteDayChange, getActiveProgram, getDayChanges, putDayChange } from '../db/index.ts'
import { toISODate } from '../lib/dates.ts'
import { currentWeek, parseISODate } from '../lib/program.ts'
import type { Program } from '../types/program.ts'
import type { DayChange } from '../types/stores.ts'
import { ProgramContext, type ProgramState } from './context.ts'

type Loaded = { program: Program | null; changes: DayChange[] }

export function ProgramProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState<Program | null>(null)
  const [changes, setChanges] = useState<DayChange[]>([])
  const [today] = useState(() => new Date())

  const read = useCallback(async (): Promise<Loaded> => {
    const active = (await getActiveProgram()) ?? null
    return { program: active, changes: await getDayChanges() }
  }, [])

  useEffect(() => {
    let live = true
    void read().then((loaded) => {
      if (!live) return
      setProgram(loaded.program)
      setChanges(loaded.changes)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [read])

  const refresh = useCallback(async () => {
    const loaded = await read()
    setProgram(loaded.program)
    setChanges(loaded.changes)
    setLoading(false)
  }, [read])

  const restoreDate = useCallback(async (date: string) => {
    await deleteDayChange(date)
    setChanges(await getDayChanges())
  }, [])

  // D-069 rule 1: from today on only; nothing else moves.
  const setChange = useCallback(
    async (date: string, dayId: string) => {
      if (!program || date < toISODate(today)) return false
      const weekday = program.days.find((d) => d.order === parseISODate(date).getDay())
      if (weekday?.id === dayId) await deleteDayChange(date)
      else await putDayChange({ date, dayId, setAt: new Date().toISOString() })
      setChanges(await getDayChanges())
      return true
    },
    [program, today],
  )

  const value = useMemo<ProgramState>(
    () => ({
      loading,
      program,
      today,
      week: program ? currentWeek(program, today) : 1,
      changes,
      refresh,
      setChange,
      restoreDate,
    }),
    [loading, program, today, changes, refresh, setChange, restoreDate],
  )

  return (
    <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>
  )
}
