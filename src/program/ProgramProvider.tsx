import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { getActiveProgram, getWeekPlan, saveWeekPlan } from '../db/index.ts'
import { currentWeek } from '../lib/program.ts'
import type { Program } from '../types/program.ts'
import type { WeekPlan } from '../types/stores.ts'
import { ProgramContext, type ProgramState } from './context.ts'

type Loaded = { program: Program | null; weekPlan: WeekPlan | null }

export function ProgramProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState<Program | null>(null)
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null)
  const [today] = useState(() => new Date())

  const read = useCallback(async (): Promise<Loaded> => {
    const active = (await getActiveProgram()) ?? null
    const plan = active
      ? ((await getWeekPlan(currentWeek(active, today))) ?? null)
      : null
    return { program: active, weekPlan: plan }
  }, [today])

  useEffect(() => {
    let live = true
    void read().then((loaded) => {
      if (!live) return
      setProgram(loaded.program)
      setWeekPlan(loaded.weekPlan)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [read])

  const refresh = useCallback(async () => {
    const loaded = await read()
    setProgram(loaded.program)
    setWeekPlan(loaded.weekPlan)
    setLoading(false)
  }, [read])

  const applySwap = useCallback(
    async (dayIdA: string, dayIdB: string) => {
      if (!program) return
      const programWeek = currentWeek(program, today)
      // A day takes part in at most one swap, so drop any pair touching either.
      const kept = (weekPlan?.swaps ?? []).filter(
        ([a, b]) =>
          a !== dayIdA && a !== dayIdB && b !== dayIdA && b !== dayIdB,
      )
      const next: WeekPlan = {
        programWeek,
        swaps: [...kept, [dayIdA, dayIdB]],
      }
      await saveWeekPlan(next)
      setWeekPlan(next)
    },
    [program, today, weekPlan],
  )

  const value = useMemo<ProgramState>(
    () => ({
      loading,
      program,
      today,
      week: program ? currentWeek(program, today) : 1,
      weekPlan,
      refresh,
      applySwap,
    }),
    [loading, program, today, weekPlan, refresh, applySwap],
  )

  return (
    <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>
  )
}
