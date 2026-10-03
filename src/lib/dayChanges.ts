// Day changes (D-069): one record per date given a day other than its
// weekday's. Older data stored weekly swap pairs (a week plan); this converts
// them, for the database upgrade to version 4 and for exports of versions 1
// and 2. Pure.

import type { Day, Program } from '../types/program.ts'
import type { DayChange, Session } from '../types/stores.ts'
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

// ── Change a day (D-069 rules 1 to 5) ──

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/** "Fri, Oct 2" */
export function shortDate(date: Date): string {
  return SHORT_DATE.format(date)
}

/**
 * Dates from today on can be changed; past dates cannot (D-069 rule 1). A date
 * with a finished session cannot either: a logged session keeps the day it was
 * logged under (D-074 rule 6). Dates are YYYY-MM-DD.
 */
export function canChangeDate(date: string, today: string, sessions: readonly Pick<Session, 'date' | 'endedAt'>[] = []): boolean {
  return date >= today && !sessions.some((s) => s.date === date && s.endedAt)
}

/** How a day is named in Week, the list and the confirmation. */
export function dayLabel(day: Pick<Day, 'name' | 'focus' | 'rest'>): string {
  return day.focus ?? day.name
}

/** The weekday's own day when a date has been changed away from it; otherwise null (rule 2). */
export function changedFrom(program: Program, changes: readonly DayChange[], date: Date, shown: Pick<Day, 'id'>): Day | null {
  const iso = toISODate(date)
  if (!changes.some((c) => c.date === iso)) return null
  const weekday = program.days.find((d) => d.order === date.getDay())
  return weekday && weekday.id !== shown.id ? weekday : null
}

/**
 * The confirmation before anything changes: it names the date and both days,
 * and, when the date is today and today has logged sets, says what happens to
 * them (rule 4).
 */
export function changeConfirmation(input: { date: Date; from: Pick<Day, 'name' | 'focus' | 'rest'>; to: Pick<Day, 'name' | 'focus' | 'rest'>; isToday: boolean; loggedToday: boolean }): { title: string; body: string } {
  const title = `Change ${shortDate(input.date)} from ${dayLabel(input.from)} to ${dayLabel(input.to)}?`
  const body =
    input.isToday && input.loggedToday
      ? `What you logged today stays under today. Today's session ends as it stands, and ${dayLabel(input.to)} starts as a second session today.`
      : 'Nothing else moves; Restore puts this date back.'
  return { title, body }
}

/** Rule 4: a session ended as it stands, as End does; nothing logged is touched. */
export function endedAsItStands(session: Session, now: Date): Session {
  return session.endedAt ? session : { ...session, endedAt: now.toISOString() }
}
