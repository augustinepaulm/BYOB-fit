// Pure rules behind first run (EXEC-07 tasks 4, 5 and 8, PLAN v1.6 Phase 7).
// Nothing here touches storage, the DOM or the clock.

import type { LoadUnit, Program } from '../types/program.ts'
import { toISODate } from './dates.ts'

// ── Routing (PLAN 7.5) ──

export type FirstRunRoute = 'proceed' | '/welcome' | '/import'

/**
 * Where the app goes on load. A program always wins, so an install that
 * already has one never sees onboarding. Without one, onboarding runs until it
 * has been completed once; after that the import screen is the way back in.
 */
export function firstRunRoute(input: {
  hasProgram: boolean
  onboardingCompletedAt: string | undefined
}): FirstRunRoute {
  if (input.hasProgram) return 'proceed'
  return input.onboardingCompletedAt ? '/import' : '/welcome'
}

// ── Starter programs (D-037) ──

export type Experience = 'new' | 'experienced'

export interface StarterTemplate {
  file: string
  /** Level as D-037 records it; the program file itself carries no level. */
  level: 'Beginner' | 'Intermediate' | 'Experienced'
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  { file: 'starter-3day-fullbody.json', level: 'Beginner' },
  { file: 'starter-4day-upper-lower.json', level: 'Intermediate' },
  { file: 'starter-5day-split.json', level: 'Experienced' },
]

/** D-037: New starts on the 3-day program, Experienced on the 4-day. */
export function suggestedTemplate(experience: Experience | undefined): string {
  return experience === 'experienced'
    ? 'starter-4day-upper-lower.json'
    : 'starter-3day-fullbody.json'
}

/** Training days a week: every day not marked rest. */
export function trainingDays(program: Program): number {
  return program.days.filter((day) => !day.rest).length
}

/** The longest durationMin among training days, or null when none is given. */
export function longestSessionMin(program: Program): number | null {
  const minutes = program.days
    .filter((day) => !day.rest && day.durationMin !== undefined)
    .map((day) => day.durationMin as number)
  return minutes.length ? Math.max(...minutes) : null
}

// ── Saving a chosen program ──

/** The Sunday on or before `date`, as a local calendar date. */
export function sundayOnOrBefore(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
}

/** Every load_reps item gets `unit`; nothing else is touched. Returns a copy. */
export function applyUnit(program: Program, unit: LoadUnit): Program {
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      sections: day.sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.type === 'load_reps' ? { ...item, unit } : item,
        ),
      })),
    })),
  }
}

/** `id` if unused, otherwise the first free `id-2`, `id-3`, and so on. */
export function uniqueProgramId(id: string, existing: Iterable<string>): string {
  const taken = new Set(existing)
  if (!taken.has(id)) return id
  let n = 2
  while (taken.has(`${id}-${n}`)) n += 1
  return `${id}-${n}`
}

/**
 * A starter template made ready to store: program week 1 starts on the Sunday
 * on or before today, loads use the chosen unit, and the id is free.
 */
export function prepareTemplate(
  template: Program,
  today: Date,
  unit: LoadUnit,
  existingIds: Iterable<string>,
): Program {
  return {
    ...applyUnit(template, unit),
    id: uniqueProgramId(template.id, existingIds),
    startDate: toISODate(sundayOnOrBefore(today)),
    schemaVersion: 2,
  }
}

/** The program's load_reps exercises, once each, in program order (1g). */
export function loadRepsExercises(program: Program): { id: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const day of program.days) {
    for (const section of day.sections) {
      for (const item of section.items) {
        if (item.type === 'load_reps' && !seen.has(item.exerciseId)) {
          seen.set(item.exerciseId, program.exercises[item.exerciseId]?.name ?? item.exerciseId)
        }
      }
    }
  }
  return [...seen].map(([id, name]) => ({ id, name }))
}
