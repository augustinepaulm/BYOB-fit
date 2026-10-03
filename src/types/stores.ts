// Stores outside the program file, per PLAN v1.5 section 5.

import type { ItemFields, LoadUnit } from './program.ts'

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
  /** When the set was edited from Log after its session ended (D-069 rule 10). */
  editedAt?: string
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
  /** Sets added today beyond the prescription (D-055, D-065 rule 5). */
  addedSets?: number
  /** The prescription logged today when it differs from the program item (D-069 rule 9). */
  fields?: ItemFields
  /** An exercise added today from the plan; its itemId is new, not a program item (D-069 rule 7). */
  added?: { fromItemId: string }
  /** An exercise swapped and logged with its own prescription (D-069 rule 8). */
  changed?: true
}

/** One date given a day other than its weekday's (D-069). */
export interface DayChange {
  /** YYYY-MM-DD */
  date: string
  dayId: string
  /** ISO date-time the change was made. */
  setAt: string
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
  /** Today's order, written only when the user moves an item (D-065 rule 1). */
  order?: { itemId: string; sectionId: string }[]
}

export interface Profile {
  fields: Record<string, string>
  updatedAt: string
}

/** D-079 rule 1: the nutrients beyond calories and protein, all optional. */
export interface MealNutrients {
  carbsG?: number
  fatG?: number
  fibreG?: number
  sodiumMg?: number
  addedSugarG?: number
  satFatG?: number
}

/** One parsed line of a meal day, as the model returns it. */
export interface ParsedMealLine extends MealNutrients {
  line: string
  kcal: number
  proteinG: number
  /** D-049 rule 3: where the numbers came from. Missing reads as 'ai'. */
  source?: MealSource
}

/** D-079 rule 4: a line can be labelled as part of a meal. */
export type MealLabel = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type MealSource = 'phone' | 'ai' | 'manual'

/** One of the user's own foods (D-049 rule 1). */
export interface MealFood extends MealNutrients {
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
  parsed?: { kcal: number; proteinG: number; items: ParsedMealLine[] } & MealNutrients
  parsedAt?: string
  /** PLAN v1.26: one entry per line, the meal it belongs to or null (D-079 rule 4). */
  lineMeals?: (MealLabel | null)[]
}

/**
 * D-078: one body entry per date; every field optional. Masses are in the
 * entry's units (kg or lb), lengths in cm with kg and inches with lb.
 */
export interface BodyEntry {
  /** YYYY-MM-DD, the key. */
  date: string
  units: LoadUnit
  weight?: number
  skeletalMuscle?: number
  bodyFatMass?: number
  bodyFatPct?: number
  visceralFat?: number
  /** kcal/day, from a scan (D-078 rule 3). */
  bmrKcal?: number
  waist?: number
  chest?: number
  hips?: number
  upperArm?: number
  thigh?: number
  updatedAt: string
}

export type ProgressView = 'training' | 'nutrition' | 'body'

/** D-081: an AI note on one week of one Progress view. */
export interface WeekNote {
  id: string
  /** The Sunday that starts the week, YYYY-MM-DD. */
  weekStart: string
  programWeek?: number
  view: ProgressView
  reply: string
  /** ISO date-time the reply arrived. */
  at: string
  model?: string
}

/** D-085 rule 3: price per million tokens, in and out, in US dollars. */
export interface ModelPrice {
  inputPerM: number
  outputPerM: number
}

/** D-085 rule 4: the optional monthly budget. */
export interface Budget {
  monthlyUsd?: number
  /** Warn at this share of the budget, in percent; default 80. */
  warnPct: number
  /** Stop sending at the budget; on by default once a budget is set. */
  stopAtBudget: boolean
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
  /** D-085 rule 3: the price table, keyed by model string; missing reads as the defaults. */
  prices?: Record<string, ModelPrice>
  /** D-085 rule 4. */
  budget?: Budget
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
  kind: 'review' | 'update' | 'meals' | 'week_note'
  privacyLevel: PrivacyLevel
  /** D-085 rule 1: the model the call used. */
  model?: string
  /** D-085 rule 1: tokens the reply reported. */
  usage?: { inputTokens: number; outputTokens: number }
  /** D-085 rule 1: the reply carried no usage, so it counts as zero. */
  usageMissing?: true
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

