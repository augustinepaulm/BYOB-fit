// Types mirroring docs/program.schema.json v2 (frozen Sep 27, PLAN v1.5 section 5, D-035).
// The schema is the contract; these types follow it and must not drift from it.

export type SectionKind =
  | 'warmup'
  | 'main'
  | 'block'
  | 'abs'
  | 'cardio'
  | 'cooldown'
  | 'daily'

export type ItemType =
  | 'load_reps'
  | 'bodyweight_reps'
  | 'timed_hold'
  | 'distance'
  | 'cardio_block'
  | 'check'

export type LoadUnit = 'kg' | 'lb'

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'glutes'
  | 'core'
  | 'full_body'
  | 'cardio'

export type Equipment =
  | 'none'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'band'
  | 'bench'
  | 'cardio_machine'
  | 'other'

export type ExerciseLevel = 'beginner' | 'intermediate' | 'experienced'

export interface Exercise {
  name: string
  howTo: string
  tags?: string[]
  /** v2: primary muscle groups, at least one, no repeats. */
  muscles?: Muscle[]
  /** v2: main equipment; none = bodyweight. */
  equipment?: Equipment
  /** v2: lowest level the exercise suits. */
  level?: ExerciseLevel
  /** v2: path under public/demos/, e.g. demos/goblet-squat.webp; never a URL (D-033). */
  demo?: string
}

/** Every property a byWeek override may carry. All optional, as in the schema. */
export interface ItemFields {
  exerciseId?: string
  type?: ItemType
  perSide?: boolean
  sets?: number
  repMin?: number
  repMax?: number
  holdSec?: number
  distanceM?: number
  minutes?: number
  /** e.g. 3-1-1 */
  tempo?: string
  restSec?: number
  /** e.g. 8 or 7 to 8 */
  rpe?: string
  /** Load unit for load_reps items; shown as entered, no conversion. */
  unit?: LoadUnit
  /** Index lift: monitored between scans, subject to the >5% rule. */
  index?: boolean
  /** Overrides the section default for whether this item logs. */
  logged?: boolean
  /** Short coaching cue shown on the tile in muted text. */
  cue?: string
  notes?: string
  /** One-tap substitute; the session records which was done. */
  alternateExerciseId?: string
}

/**
 * Keys are program week numbers as strings. Overrides are cumulative (D-023):
 * for week W, every override with key <= W applies in ascending order on top of
 * the base item, later keys overwriting earlier ones field by field.
 */
export type ByWeek = Record<string, ItemFields>

export interface Item extends ItemFields {
  id: string
  exerciseId: string
  type: ItemType
  byWeek?: ByWeek
  /**
   * v2 (D-028): retired, not deleted. The item does not appear on days dated on
   * or after this ISO date; its logged history stays in the Log. Not a field a
   * byWeek override may carry.
   */
  retiredFrom?: string
}

export interface Section {
  id: string
  kind: SectionKind
  title: string
  items: Item[]
}

export interface Day {
  id: string
  /** 0 = Sunday */
  order: number
  name: string
  focus?: string
  durationMin?: number
  /** Day id this day may swap with in a given week. */
  swappableWith?: string
  rest?: boolean
  sections: Section[]
}

export interface Program {
  /** Import accepts 1 and 2 and stores 2 (D-035). */
  schemaVersion: 1 | 2
  id: string
  name: string
  /** Free text, e.g. v11 */
  version?: string
  weekStartsOn: 'sunday'
  programWeeks: number
  /** The Sunday that begins program week 1, as an ISO date. */
  startDate: string
  notes?: string
  exercises: Record<string, Exercise>
  days: Day[]
}
