// Validation and import of a program file. The contract is
// docs/program.schema.json; its validator is compiled ahead of time into
// validators.generated.js (D-066 rule 2), so nothing compiles in the browser.

import type { ErrorObject } from 'ajv/dist/2020'

import type { ItemFields, Program } from '../types/program.ts'
import { parseISODate, upgradeProgram } from './program.ts'
import { validateProgram } from './validators.generated.js'

export type ImportResult =
  | { ok: true; program: Program }
  | { ok: false; errors: string[] }

// The schema is the contract and src/types/program.ts mirrors it, so the
// precompiled validator is typed as the guard for Program.
const validate = validateProgram as unknown as ((data: unknown) => data is Program) & { errors?: ErrorObject[] | null }

/** Turn one Ajv error into a line a person can act on, keyed by JSON path. */
function formatError(error: ErrorObject): string {
  const path = error.instancePath || '/'
  const params = error.params as Record<string, unknown>
  switch (error.keyword) {
    case 'required':
      return `${path}: missing required property "${String(params.missingProperty)}"`
    case 'additionalProperties':
    case 'unevaluatedProperties':
      return `${path}: unknown property "${String(
        params.additionalProperty ?? params.unevaluatedProperty,
      )}"`
    case 'enum':
      return `${path}: must be one of ${JSON.stringify(params.allowedValues)}`
    case 'const':
      return `${path}: must be ${JSON.stringify(params.allowedValue)}`
    default:
      return `${path}: ${error.message ?? 'is invalid'}`
  }
}

/** Every exercise reference an item carries, base fields and byWeek alike. */
function itemReferences(
  fields: ItemFields,
  path: string,
): { path: string; id: string }[] {
  const refs: { path: string; id: string }[] = []
  if (fields.exerciseId !== undefined) {
    refs.push({ path: `${path}/exerciseId`, id: fields.exerciseId })
  }
  if (fields.alternateExerciseId !== undefined) {
    refs.push({
      path: `${path}/alternateExerciseId`,
      id: fields.alternateExerciseId,
    })
  }
  return refs
}

/**
 * The schema can say `format: date` but not "is a Sunday", so the week-start
 * rule is checked here: program week 1 begins on the startDate, and every week
 * boundary after it is a Sunday.
 */
function startDateErrors(program: Program): string[] {
  const date = parseISODate(program.startDate)
  if (date.getDay() === 0) return []
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date)
  return [
    `/startDate: must be a Sunday, but ${program.startDate} is a ${weekday}`,
  ]
}

/** Check that every exercise id an item names actually exists in `exercises`. */
function referenceErrors(program: Program): string[] {
  const errors: string[] = []
  program.days.forEach((day, di) => {
    day.sections.forEach((section, si) => {
      section.items.forEach((item, ii) => {
        const base = `/days/${di}/sections/${si}/items/${ii}`
        const refs = itemReferences(item, base)
        for (const [week, override] of Object.entries(item.byWeek ?? {})) {
          refs.push(...itemReferences(override, `${base}/byWeek/${week}`))
        }
        for (const ref of refs) {
          if (!Object.prototype.hasOwnProperty.call(program.exercises, ref.id)) {
            errors.push(`${ref.path}: no exercise with id "${ref.id}"`)
          }
        }
      })
    })
  })
  return errors
}

/**
 * retiredFrom belongs to the item, not to a week (D-028, PLAN v1.5 section 5).
 * The schema's itemFields does not close its property list, so an override
 * carrying it would otherwise pass; it is refused here.
 */
function byWeekRetiredErrors(program: Program): string[] {
  const errors: string[] = []
  program.days.forEach((day, di) => {
    day.sections.forEach((section, si) => {
      section.items.forEach((item, ii) => {
        for (const [week, override] of Object.entries(item.byWeek ?? {})) {
          if (Object.prototype.hasOwnProperty.call(override, 'retiredFrom')) {
            errors.push(
              `/days/${di}/sections/${si}/items/${ii}/byWeek/${week}/retiredFrom: retirement is set on the item, not in a byWeek override`,
            )
          }
        }
      })
    })
  })
  return errors
}

/**
 * Validate an unknown JSON value against the schema and its own references.
 * Version 1 and 2 files are accepted; the program returned is always version 2
 * (D-035), so that is what gets stored.
 */
export function importProgram(value: unknown): ImportResult {
  if (!validate(value)) {
    const errors = (validate.errors ?? []).map(formatError)
    return { ok: false, errors: errors.length ? errors : ['File is not a valid program.'] }
  }
  const errors = [
    ...startDateErrors(value),
    ...referenceErrors(value),
    ...byWeekRetiredErrors(value),
  ]
  if (errors.length) return { ok: false, errors }
  return { ok: true, program: upgradeProgram(value) }
}

/** Parse text as JSON, then validate it. */
export function importProgramText(text: string): ImportResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      errors: [`/: file is not valid JSON (${(error as Error).message})`],
    }
  }
  return importProgram(value)
}
