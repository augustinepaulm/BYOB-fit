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

/** One parsed line of a meal day, as the model returns it. */
export interface ParsedMealLine {
  line: string
  kcal: number
  proteinG: number
}

export interface MealDay {
  /** ISO date, YYYY-MM-DD. */
  date: string
  lines: string[]
  /**
   * PLAN section 5 left the element type of `items` open; EXEC-04 task 6 fixes
   * it as one record per input line.
   */
  parsed?: { kcal: number; proteinG: number; items: ParsedMealLine[] }
  parsedAt?: string
}

export interface Settings {
  /** Stored on this device only; never logged and never exported (D-004). */
  apiKey?: string
  model?: string
  /** Plain-text rules the reprogramming prompt must follow (PLAN O-5). */
  rules?: string
  /** Plain-text description of the DFS baseline, sent with meal parsing. */
  mealBaseline?: string
  lastExportAt?: string
}

/** One reprogramming round trip, kept whether or not it was approved (D-016). */
export interface Reprogram {
  id: string
  /** The program week the proposal targets. */
  week: number
  timestamp: string
  model: string
  /** The model's response exactly as returned. */
  raw: string
  approved: boolean
}

/** Day swaps recorded for one program week. */
export interface WeekPlan {
  programWeek: number
  swaps: [string, string][]
}
