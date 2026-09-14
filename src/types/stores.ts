// Stores outside the program file, per PLAN v1.3 section 5.

export interface SetLog {
  n: number
  side?: 'L' | 'R'
  weight?: number
  reps?: number
  seconds?: number
  distanceM?: number
  minutes?: number
  rpe?: string
  /** Unparseable input is kept here verbatim, never silently zeroed. */
  raw?: string
}

export interface Entry {
  itemId: string
  /** The exercise as performed, which may be the item's alternate. */
  exerciseId: string
  sets: SetLog[]
  checked?: boolean
  note?: string
}

export interface Session {
  id: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  dayId: string
  programWeek: number
  startedAt?: string
  endedAt?: string
  swapped?: boolean
  entries: Entry[]
}

export interface Profile {
  fields: Record<string, string>
  updatedAt: string
}

export interface MealDay {
  /** ISO date, YYYY-MM-DD. */
  date: string
  lines: string[]
  parsed?: { kcal: number; proteinG: number; items: string[] }
  parsedAt?: string
}

export interface Settings {
  apiKey?: string
  model?: string
  lastExportAt?: string
}

/** Day swaps recorded for one program week. */
export interface WeekPlan {
  programWeek: number
  swaps: [string, string][]
}
