// Validation and import of a program file. The contract is
// docs/program.schema.json, imported directly so there is one copy of it.

import Ajv2020 from 'ajv/dist/2020'
import type { ErrorObject } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

import schema from '../../docs/program.schema.json'
import type { ItemFields, Program } from '../types/program.ts'

export type ImportResult =
  | { ok: true; program: Program }
  | { ok: false; errors: string[] }

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
// The schema is the contract and src/types/program.ts mirrors it, so the
// compiled validator is typed as the guard for Program.
const validate = ajv.compile<Program>(schema as object)

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

/** Validate an unknown JSON value against the schema and its own references. */
export function importProgram(value: unknown): ImportResult {
  if (!validate(value)) {
    const errors = (validate.errors ?? []).map(formatError)
    return { ok: false, errors: errors.length ? errors : ['File is not a valid program.'] }
  }
  const errors = referenceErrors(value)
  if (errors.length) return { ok: false, errors }
  return { ok: true, program: value }
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
