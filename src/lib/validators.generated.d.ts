// Types for validators.generated.js, which scripts/build-validators.mjs writes
// (D-066 rule 2). Each is an Ajv standalone validator: call it, then read
// `.errors` when it returns false.

import type { ErrorObject } from 'ajv/dist/2020'

export interface GeneratedValidator {
  (data: unknown): boolean
  errors?: ErrorObject[] | null
}

/** docs/program.schema.json as a whole. */
export declare const validateProgram: GeneratedValidator
/** One item: `{ $ref: <schema $id>#/$defs/item }`. */
export declare const validateItem: GeneratedValidator
/** Item fields with no other properties (D-038): `$defs/itemFields`, unevaluatedProperties false. */
export declare const validateItemFields: GeneratedValidator
