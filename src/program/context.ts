import { createContext } from 'react'

import type { Program } from '../types/program.ts'
import type { DayChange } from '../types/stores.ts'

export interface ProgramState {
  loading: boolean
  program: Program | null
  /** One "today" shared by every screen, fixed when the app loads. */
  today: Date
  week: number
  /** D-069: every changed date. */
  changes: DayChange[]
  refresh: () => Promise<void>
  /**
   * Give a date (YYYY-MM-DD) another day of the program. Refused (false) for a
   * date before today; choosing the date's own weekday day restores it.
   */
  setChange: (date: string, dayId: string) => Promise<boolean>
  /** Put a date's own workout back. */
  restoreDate: (date: string) => Promise<void>
}

export const ProgramContext = createContext<ProgramState | null>(null)
