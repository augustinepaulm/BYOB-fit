// Day changes (D-069): one record per date given a day other than its
// weekday's. Older data stored weekly swap pairs (a week plan); this converts
// them, for the database upgrade to version 4 and for exports of versions 1
// and 2. Pure.

import type { Program } from '../types/program.ts'
import type { DayChange } from '../types/stores.ts'
import { toISODate } from './dates.ts'
import { weekDates } from './program.ts'

/** The shape older versions stored: day swaps for one program week. */
export interface LegacyWeekPlan {
  programWeek: number
  swaps: [string, string][]
}

/**
 * For each date of each plan's program week whose weekday day is one of a
 * swapped pair, a change to its partner, as the old weekly lookup gave. Pairs
 * naming a day the program no longer has are dropped.
 */
export function dayChangesFromWeekPlans(program: Program | null | undefined, plans: readonly LegacyWeekPlan[], setAt: string): DayChange[] {
  if (!program) return []
  const ids = new Set(program.days.map((d) => d.id))
  const changes: DayChange[] = []
  for (const plan of plans) {
    for (const date of weekDates(program, plan.programWeek)) {
      const scheduled = program.days.find((d) => d.order === date.getDay())
      if (!scheduled) continue
      for (const [a, b] of plan.swaps ?? []) {
        const partner = a === scheduled.id ? b : b === scheduled.id ? a : null
        if (partner === null) continue
        if (ids.has(partner) && partner !== scheduled.id) changes.push({ date: toISODate(date), dayId: partner, setAt })
        break
      }
    }
  }
  return changes
}
