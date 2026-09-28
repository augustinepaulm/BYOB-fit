// Structured goals (D-030): pure rules for choosing, ordering and describing
// them. The wording follows frames 1h and 5a.

import type { LoadUnit } from '../types/program.ts'
import type { Activity, GoalType, Goals } from '../types/stores.ts'

export const MAX_GOALS = 3
export const TIMEFRAMES = [4, 8, 12, 16] as const
export type Timeframe = (typeof TIMEFRAMES)[number]

/** Frame 1f's list, in its order. */
export const GOAL_TYPES: { type: GoalType; label: string }[] = [
  { type: 'lose_weight', label: 'Lose weight' },
  { type: 'lose_fat', label: 'Lose body fat' },
  { type: 'build_muscle', label: 'Build muscle' },
  { type: 'get_stronger', label: 'Get stronger' },
  { type: 'improve_cardio', label: 'Improve cardio' },
  { type: 'general', label: 'General fitness' },
]

export function goalLabel(type: GoalType): string {
  return GOAL_TYPES.find((g) => g.type === type)?.label ?? type
}

/** A goal while it is being edited; its rank is its position in the list. */
export interface GoalDraft {
  type: GoalType
  amount?: number
  unit?: LoadUnit
  exerciseId?: string
}

/** Which goals take a number, and what kind (task 5, 1g). */
export function targetKind(type: GoalType): 'weight' | 'percent' | 'strength' | null {
  if (type === 'lose_weight') return 'weight'
  if (type === 'lose_fat') return 'percent'
  if (type === 'get_stronger') return 'strength'
  return null
}

/** A new draft with the defaults frame 1g shows. */
export function newGoal(type: GoalType, unit: LoadUnit): GoalDraft {
  const kind = targetKind(type)
  if (kind === 'weight' || kind === 'strength') return { type, amount: 10, unit }
  if (kind === 'percent') return { type, amount: 5 }
  return { type }
}

/**
 * Tap a goal in the picker: selected goals are removed; others are added at
 * the end, unless three are already chosen.
 */
export function toggleGoal(goals: GoalDraft[], type: GoalType, unit: LoadUnit): GoalDraft[] {
  if (goals.some((g) => g.type === type)) return goals.filter((g) => g.type !== type)
  if (goals.length >= MAX_GOALS) return goals
  return [...goals, newGoal(type, unit)]
}

/** Exactly one main goal (the first) and at most three in all. */
export function goalsValid(goals: GoalDraft[]): boolean {
  return (
    goals.length >= 1 &&
    goals.length <= MAX_GOALS &&
    new Set(goals.map((g) => g.type)).size === goals.length
  )
}

/** "Main", "2nd", "3rd" (frame 1f). */
export function rankBadge(index: number): string {
  return ['Main', '2nd', '3rd'][index] ?? `${index + 1}th`
}

/** Move the goal at `from` to `to`, keeping the rest in order. */
export function moveGoal(goals: GoalDraft[], from: number, to: number): GoalDraft[] {
  if (to < 0 || to >= goals.length || from === to) return goals
  const next = [...goals]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** The target line under a goal in frames 1h and 5a, or null for none. */
export function goalDetail(goal: GoalDraft, exerciseName?: string): string | null {
  const kind = targetKind(goal.type)
  if (kind === null || goal.amount === undefined) return null
  if (kind === 'weight') return `Lose ${goal.amount} ${goal.unit ?? 'kg'}`
  if (kind === 'percent') return `Lose ${goal.amount}% body fat`
  const to = exerciseName ? ` to ${lowerFirst(exerciseName)}` : ''
  return `Add ${goal.amount} ${goal.unit ?? 'kg'}${to}`
}

/** How a goal reads after "then": the plain goal, lower-cased. */
const LATER: Record<GoalType, string> = {
  lose_weight: 'lose weight',
  lose_fat: 'lose body fat',
  build_muscle: 'build muscle',
  get_stronger: 'get stronger',
  improve_cardio: 'improve cardio',
  general: 'improve general fitness',
}

/**
 * Frame 1h: "Lose 10 lb in 12 weeks, then get stronger." The main goal carries
 * its target and the timeframe; the others follow "then", joined by "and".
 */
export function goalSummary(
  goals: GoalDraft[],
  weeks: number,
  exerciseName?: (id: string) => string | undefined,
): string {
  if (goals.length === 0) return ''
  const [main, ...rest] = goals
  const name = main.exerciseId ? exerciseName?.(main.exerciseId) : undefined
  const plain = LATER[main.type]
  const head = goalDetail(main, name) ?? plain.charAt(0).toUpperCase() + plain.slice(1)
  const then = rest.length ? `, then ${rest.map((g) => LATER[g.type]).join(' and ')}` : ''
  return `${head} in ${weeks} weeks${then}.`
}

/** The date a timeframe ends: `weeks` whole weeks after the start. */
export function timeframeEnd(start: Date, weeks: number): Date {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7)
}

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** "12 weeks, ending Dec 20" (frame 1g). */
export function timeframeLine(start: Date, weeks: number): string {
  return `${weeks} weeks, ending ${MONTH_DAY.format(timeframeEnd(start, weeks))}`
}

/** Drafts to the stored record, ranks from list order. */
export function toGoals(
  drafts: GoalDraft[],
  input: {
    timeframeWeeks: Timeframe
    startDate: string
    currentStats?: Goals['currentStats']
    now: Date
  },
): Goals {
  const goals: Goals = {
    items: drafts.map((draft, i) => {
      const kind = targetKind(draft.type)
      const item: Goals['items'][number] = { rank: i + 1, type: draft.type }
      if (kind !== null && draft.amount !== undefined) {
        item.target = {
          amount: draft.amount,
          unit: kind === 'percent' ? 'percent' : (draft.unit ?? 'kg'),
        }
        if (kind === 'strength' && draft.exerciseId) item.target.exerciseId = draft.exerciseId
      }
      return item
    }),
    timeframeWeeks: input.timeframeWeeks,
    startDate: input.startDate,
    updatedAt: input.now.toISOString(),
  }
  if (input.currentStats) goals.currentStats = input.currentStats
  return goals
}

/** The stored record back to drafts, in rank order. */
export function fromGoals(goals: Goals): GoalDraft[] {
  return [...goals.items]
    .sort((a, b) => a.rank - b.rank)
    .map((item) => {
      const draft: GoalDraft = { type: item.type }
      if (item.target) {
        draft.amount = item.target.amount
        if (item.target.unit === 'kg' || item.target.unit === 'lb') draft.unit = item.target.unit
        if (item.target.exerciseId) draft.exerciseId = item.target.exerciseId
      }
      return draft
    })
}

/** The first weight unit a goal names, used to pre-select step 6 (1i). */
export function unitFromGoals(goals: GoalDraft[]): LoadUnit | undefined {
  return goals.find((g) => g.unit !== undefined)?.unit
}

/** Optional current stats from what was typed; blanks and non-numbers are dropped. */
export function statsFromInput(
  weight: string,
  bodyFat: string,
  unit: LoadUnit,
): Goals['currentStats'] | undefined {
  const w = Number(weight.trim().replace(',', '.'))
  const f = Number(bodyFat.trim().replace(',', '.'))
  const stats: NonNullable<Goals['currentStats']> = {}
  if (weight.trim() !== '' && Number.isFinite(w) && w > 0) {
    stats.weight = w
    stats.weightUnit = unit
  }
  if (bodyFat.trim() !== '' && Number.isFinite(f) && f > 0 && f < 100) stats.bodyFatPct = f
  return Object.keys(stats).length ? stats : undefined
}

/** Height, age, sex and activity while editing (5a, EXEC-10B task 8). */
export interface ProfileDraft {
  heightCm: string
  feet: string
  inches: string
  age: string
  sex?: 'male' | 'female'
  activity?: Activity
}

const INCH_CM = 2.54

function positive(text: string): number | undefined {
  if (text.trim() === '') return undefined
  const n = Number(text.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Stored stats to the form: height in cm, or ft and in when the display unit is lb. */
export function profileDraft(stats: Goals['currentStats'], unit: LoadUnit): ProfileDraft {
  const draft: ProfileDraft = { heightCm: '', feet: '', inches: '', age: stats?.age !== undefined ? String(stats.age) : '', sex: stats?.sex, activity: stats?.activity }
  if (stats?.heightCm !== undefined) {
    if (unit === 'lb') {
      const total = Math.round(stats.heightCm / INCH_CM)
      draft.feet = String(Math.floor(total / 12))
      draft.inches = String(total % 12)
    } else {
      draft.heightCm = String(stats.heightCm)
    }
  }
  return draft
}

/** The form to stored fields; blank or invalid entries are left out. */
export function profileFromInput(draft: ProfileDraft, unit: LoadUnit): NonNullable<Goals['currentStats']> {
  const out: NonNullable<Goals['currentStats']> = {}
  if (unit === 'lb') {
    const ft = draft.feet.trim() === '' ? 0 : positive(draft.feet)
    const inch = draft.inches.trim() === '' ? 0 : Number(draft.inches.trim().replace(',', '.'))
    const total = (ft ?? NaN) * 12 + inch
    if (Number.isFinite(total) && inch >= 0 && total > 0) out.heightCm = Math.round(total * INCH_CM * 10) / 10
  } else {
    const cm = positive(draft.heightCm)
    if (cm !== undefined) out.heightCm = cm
  }
  const age = positive(draft.age)
  if (age !== undefined) out.age = Math.round(age)
  if (draft.sex) out.sex = draft.sex
  if (draft.activity) out.activity = draft.activity
  return out
}
