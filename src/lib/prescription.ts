// Prescription text for a resolved item, per EXEC-02 task 9. The multiplication
// sign matches the design file, which writes "4 × 6 to 8" and "3 × 45 s".

import type { ItemFields } from '../types/program.ts'

export function prescriptionText(fields: ItemFields): string {
  let text = ''
  if (fields.minutes !== undefined) {
    text = `${fields.minutes} min`
  } else {
    const prefix = fields.sets !== undefined ? `${fields.sets} × ` : ''
    if (fields.holdSec !== undefined) {
      text = `${prefix}${fields.holdSec} s`
    } else if (fields.distanceM !== undefined) {
      text = `${prefix}${fields.distanceM} m`
    } else if (fields.repMin !== undefined) {
      const reps =
        fields.repMax !== undefined && fields.repMax !== fields.repMin
          ? `${fields.repMin} to ${fields.repMax}`
          : `${fields.repMin}`
      text = `${prefix}${reps}`
    } else if (fields.sets !== undefined) {
      text = `${fields.sets} sets`
    }
  }
  if (!text) return ''
  return fields.perSide ? `${text} per side` : text
}
