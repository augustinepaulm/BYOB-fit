// Calorie and protein target (D-046, D-049 rule 4, docs/TARGETS-AND-PROGRESSION.md
// Part 1). Computed on the phone and never sent. Pure.

import type { Activity, BodyEntry, Goals } from '../types/stores.ts'
import { LB_TO_KG, recentBmr } from './body.ts'

export { LB_TO_KG }

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sitting: 1.53,
  active: 1.76,
  very_active: 2.25,
}

export interface Targets {
  kcal?: number
  proteinG?: number
  floorApplied: boolean
  /** The safety floor (D-046), with a calorie target; the energy band starts no lower. */
  floor?: number
  /** D-078 rule 3: where resting energy came from, when there is a calorie target. */
  resting?: { source: 'bmr'; date: string } | { source: 'formula' }
}

function mainGoalLoses(goals: Goals): boolean {
  const main = [...goals.items].sort((a, b) => a.rank - b.rank)[0]
  return main?.type === 'lose_weight' || main?.type === 'lose_fat'
}

/**
 * D-046 with D-078 rule 3: an entered BMR no more than 8 weeks old replaces
 * Mifflin-St Jeor as resting energy; the same activity factor, goal
 * adjustment and safety floor apply. `today` is YYYY-MM-DD.
 */
export function computeTargets(goals: Goals | null | undefined, bodyEntries: BodyEntry[] = [], today?: string): Targets {
  const stats = goals?.currentStats
  if (!goals || !stats?.weight) return { floorApplied: false }
  const kg = stats.weightUnit === 'lb' ? stats.weight * LB_TO_KG : stats.weight
  const lose = mainGoalLoses(goals)
  const proteinG = Math.round((kg * (lose ? 2.0 : 1.6)) / 5) * 5

  const { heightCm, age, sex, activity } = stats
  const bmr = today ? recentBmr(bodyEntries, today) : undefined
  // The activity factor and the floor need activity and sex in either case.
  if (activity === undefined || sex === undefined) return { proteinG, floorApplied: false }
  let resting: number
  let source: Targets['resting']
  if (bmr) {
    resting = bmr.kcal
    source = { source: 'bmr', date: bmr.date }
  } else {
    if (heightCm === undefined || age === undefined) return { proteinG, floorApplied: false }
    // Mifflin-St Jeor resting energy.
    resting = 10 * kg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
    source = { source: 'formula' }
  }
  const daily = resting * ACTIVITY_FACTOR[activity] - (lose ? 500 : 0)
  const floor = sex === 'male' ? 1500 : 1200
  const floorApplied = daily < floor
  const kcal = Math.round(Math.max(daily, floor) / 10) * 10
  return { kcal, proteinG, floorApplied, floor, resting: source }
}
