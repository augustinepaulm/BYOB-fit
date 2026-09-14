import { createContext } from 'react'

import type { Program } from '../types/program.ts'
import type { WeekPlan } from '../types/stores.ts'

export interface ProgramState {
  loading: boolean
  program: Program | null
  /** One "today" shared by every screen, fixed when the app loads. */
  today: Date
  week: number
  weekPlan: WeekPlan | null
  refresh: () => Promise<void>
  applySwap: (dayIdA: string, dayIdB: string) => Promise<void>
}

export const ProgramContext = createContext<ProgramState | null>(null)
