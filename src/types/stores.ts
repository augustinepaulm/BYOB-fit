// Stores outside the program file, per PLAN v1.5 section 5.

import type { LoadUnit } from './program.ts'

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
  /** D-048: how the exercise felt. Discomfort also marks the entry skipped. */
  feltOff?: FeltOff
  /** The rest of the exercise was skipped today (set with Discomfort). */
  skipped?: boolean
}

export type FeltOff = 'easy' | 'hard' | 'discomfort'

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
  /** D-049 rule 3: where the numbers came from. Missing reads as 'ai'. */
  source?: MealSource
}

export type MealSource = 'phone' | 'ai' | 'manual'

/** One of the user's own foods (D-049 rule 1). */
export interface MealFood {
  name: string
  kcal: number
  proteinG?: number
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
  /** Free-text notes sent only with lines that need the model (D-049 rule 1). */
  mealBaseline?: string
  /** The user's own foods, matched on the phone (D-049 rule 1). */
  mealFoods?: MealFood[]
  lastExportAt?: string
  /**
   * Result of navigator.storage.persist() on the first program import (EXEC-05
   * task 5); false when the API is missing. Absent until that import. Belongs
   * to this device, so it is left out of exports and ignored on restore.
   */
  storagePersisted?: boolean
  /** navigator.storage.estimate() at the same moment, where supported. */
  storageEstimate?: { usage?: number; quota?: number; at: string }
  /** Display unit (D-012 as amended). Missing reads as kg; see unitsOf. */
  units?: LoadUnit
  /** What a model call may carry (D-031). Missing reads as minimal; see privacyLevelOf. */
  privacyLevel?: PrivacyLevel
  onboarding?: {
    completedAt?: string
    followsProgram?: boolean
    experience?: 'new' | 'experienced'
    safetyAckAt?: string
  }
  /** System follows the phone; Light and Dark override it for this app (D-039). */
  appearance?: Appearance
  /** Monthly backup note on Today (D-050 rule 2); missing means on. */
  backupReminder?: boolean
  /** When the backup note was last dismissed. */
  backupNoteDismissedAt?: string
  /** Program ids whose review suggestion banner the user has dismissed. */
  reviewBannerDismissedFor?: string[]
}

export type PrivacyLevel = 'minimal' | 'standard' | 'full'

export type Activity = 'sitting' | 'active' | 'very_active'

export type Appearance = 'system' | 'light' | 'dark'

export type GoalType =
  | 'lose_weight'
  | 'lose_fat'
  | 'build_muscle'
  | 'get_stronger'
  | 'improve_cardio'
  | 'general'

/** Structured goals (D-030), one record keyed "me". */
export interface Goals {
  items: {
    rank: number
    type: GoalType
    target?: {
      amount: number
      unit: 'lb' | 'kg' | 'percent' | 'km' | 'min'
      exerciseId?: string
    }
  }[]
  timeframeWeeks: 4 | 8 | 12 | 16
  /** ISO date, YYYY-MM-DD. */
  startDate: string
  /** Stored on the phone; never sent to the model (D-030). */
  currentStats?: {
    weight?: number
    weightUnit?: LoadUnit
    bodyFatPct?: number
    /** D-046: for the calorie formula; stored on the phone, never sent. */
    heightCm?: number
    age?: number
    sex?: 'male' | 'female'
    activity?: Activity
  }
  updatedAt: string
}

/** One model call as sent, read-only once written (D-031). PLAN calls it SentLog. */
export interface SentLogEntry {
  id: string
  /** ISO date-time of the call. */
  at: string
  kind: 'review' | 'update' | 'meals'
  privacyLevel: PrivacyLevel
  /** One-line description of what was sent, for the list view. */
  payloadSummary: string
  /** Exactly what was sent, as JSON. */
  payload: unknown
  /** Set when the call returns (D-050 rule 1); a missing status reads as sent. */
  status?: 'sent' | 'failed'
  /** The error message of a failed call. */
  error?: string
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
