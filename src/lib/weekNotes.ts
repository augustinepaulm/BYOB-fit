// AI notes on a week (D-081). Pure: the system prompt, what each view sends
// besides the score, and the stored note.

import type { Program } from '../types/program.ts'
import type { MealDay, ProgressView, Session, WeekNote } from '../types/stores.ts'
import type { BodyComparison, NutritionDay, TrainingCounts } from './scores.ts'
import type { Targets } from './targets.ts'

/** Task 14: word for word. */
export const WEEK_NOTE_SYSTEM =
  "You review one week of a person's training, nutrition or body data from a workout app. Write three to five plain sentences: what moved, what held, and one thing to watch next week. Use only the data given; do not recalculate the score. No medical advice, no exclamation marks."

/** The week's underlying data for the training view: the counts; sets go as the logged sessions. */
export function trainingWeekData(counts: TrainingCounts) {
  return {
    workouts: { finished: counts.finished, planned: counts.planned },
    sets: { confirmed: counts.confirmed, prescribed: counts.prescribed },
    progression: { up: counts.up, same: counts.same, down: counts.down, new: counts.newCount },
  }
}

/** Nutrition: daily totals against the targets. Never the food lines. */
export function nutritionWeekData(days: NutritionDay[], meals: MealDay[], targets: Targets, fibre: number | undefined) {
  return {
    targets: { kcal: targets.kcal ?? null, proteinG: targets.proteinG ?? null, fibreG: fibre ?? null, floorApplied: targets.floorApplied },
    days: days.map((d) => {
      if (!d.logged) return { date: d.date, logged: false }
      const parsed = meals.find((m) => m.date === d.date)?.parsed
      const totals: Record<string, number | boolean | string> = { date: d.date, logged: true }
      for (const key of ['kcal', 'proteinG', 'carbsG', 'fatG', 'fibreG', 'sodiumMg', 'addedSugarG', 'satFatG'] as const) {
        const value = parsed?.[key]
        if (value !== undefined) totals[key] = value
      }
      return totals
    }),
  }
}

/** Body: the comparison behind the score; the entries themselves go at every level (D-084 rule 2). */
export function bodyWeekData(comparison: BodyComparison | null) {
  if (!comparison) return { comparison: null }
  return {
    comparison: {
      latest: comparison.latest.date,
      reference: comparison.reference.date,
      measures: comparison.measures.map((m) => ({ measure: m.measure, change: m.change, band: m.band, value: m.value })),
    },
  }
}

/** The sessions a training week review sends (confirmed sets with dates, D-044 Minimal). */
export function weekSessions(sessions: Session[], dates: string[]): Session[] {
  return sessions.filter((s) => dates.includes(s.date) && s.endedAt)
}

/** The program goes only with a training review. */
export function programFor(view: ProgressView, program: Program | null): Program | null {
  return view === 'training' ? program : null
}

export function newWeekNote(input: { weekStart: string; programWeek?: number; view: ProgressView; reply: string; model?: string }, now: Date): WeekNote {
  const at = now.toISOString()
  return {
    id: `${at}__${input.view}`,
    weekStart: input.weekStart,
    ...(input.programWeek !== undefined ? { programWeek: input.programWeek } : {}),
    view: input.view,
    reply: input.reply.trim(),
    at,
    ...(input.model ? { model: input.model } : {}),
  }
}

/** One view's notes for a week, newest first (D-081 rule 2). */
export function notesFor(notes: WeekNote[], weekStart: string, view: ProgressView): WeekNote[] {
  return notes.filter((n) => n.weekStart === weekStart && n.view === view).sort((a, b) => b.at.localeCompare(a.at))
}
