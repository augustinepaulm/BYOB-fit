// Calorie and protein target (D-046, D-049 rule 4, docs/TARGETS-AND-PROGRESSION.md
// Part 1). Computed on the phone and never sent. Pure.

import type { Activity, Goals } from '../types/stores.ts'

export const LB_TO_KG = 0.45359237

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sitting: 1.53,
  active: 1.76,
  very_active: 2.25,
}

export interface Targets {
  kcal?: number
  proteinG?: number
  floorApplied: boolean
}

function mainGoalLoses(goals: Goals): boolean {
  const main = [...goals.items].sort((a, b) => a.rank - b.rank)[0]
  return main?.type === 'lose_weight' || main?.type === 'lose_fat'
}

export function computeTargets(goals: Goals | null | undefined): Targets {
  const stats = goals?.currentStats
  if (!goals || !stats?.weight) return { floorApplied: false }
  const kg = stats.weightUnit === 'lb' ? stats.weight * LB_TO_KG : stats.weight
  const lose = mainGoalLoses(goals)
  const proteinG = Math.round((kg * (lose ? 2.0 : 1.6)) / 5) * 5

  const { heightCm, age, sex, activity } = stats
  if (heightCm === undefined || age === undefined || sex === undefined || activity === undefined) {
    return { proteinG, floorApplied: false }
  }
  // Mifflin-St Jeor resting energy, then the activity factor.
  const resting = 10 * kg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
  const daily = resting * ACTIVITY_FACTOR[activity] - (lose ? 500 : 0)
  const floor = sex === 'male' ? 1500 : 1200
  const floorApplied = daily < floor
  const kcal = Math.round(Math.max(daily, floor) / 10) * 10
  return { kcal, proteinG, floorApplied }
}
