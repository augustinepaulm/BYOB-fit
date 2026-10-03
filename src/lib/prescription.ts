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

/** How a recorded set reads: "60 × 8", "8 reps", "45 s", "400 m", "24 min". */
export function formatSetValue(set: {
  weight?: number
  reps?: number
  seconds?: number
  distanceM?: number
  minutes?: number
}): string {
  if (set.weight !== undefined && set.reps !== undefined) {
    return `${set.weight} × ${set.reps}`
  }
  if (set.reps !== undefined) return `${set.reps} reps`
  if (set.seconds !== undefined) return `${set.seconds} s`
  if (set.distanceM !== undefined) return `${set.distanceM} m`
  if (set.minutes !== undefined) return `${set.minutes} min`
  if (set.weight !== undefined) return `${set.weight}`
  return ''
}

/** "rest 3 min" stays whole where it can, otherwise seconds. */
export function formatRest(restSec: number): string {
  return restSec % 60 === 0 ? `${restSec / 60} min` : `${restSec} s`
}

/** m:ss for the rest and hold timers. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** The deck's prescription as a sentence (v3 frames 2.04 to 2.07): "4 sets of 6 to 8", "3 holds of 45 s". */
export function prescriptionSentence(fields: ItemFields): string {
  const sets = fields.sets ?? 1
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
  let text: string
  if (fields.minutes !== undefined) text = plural(fields.minutes, 'minute')
  else if (fields.holdSec !== undefined) text = `${plural(sets, 'hold')} of ${fields.holdSec} s`
  else if (fields.distanceM !== undefined) text = `${plural(sets, 'set')} of ${fields.distanceM} m`
  else if (fields.repMin !== undefined) {
    const reps = fields.repMax !== undefined && fields.repMax !== fields.repMin ? `${fields.repMin} to ${fields.repMax}` : `${fields.repMin}`
    text = `${plural(sets, 'set')} of ${reps}`
  } else text = plural(sets, 'set')
  return fields.perSide ? `${text}, each side` : text
}

/** A logged entry in one line: "70 kg × 8, 8, 7, 7" when the weight held, else each set. */
export function entryLine(sets: { weight?: number; reps?: number; seconds?: number; distanceM?: number; minutes?: number }[], unit: string): string {
  if (sets.length === 0) return ''
  const weights = new Set(sets.map((s) => s.weight))
  if (sets[0].weight !== undefined && weights.size === 1 && sets.every((s) => s.reps !== undefined)) return `${sets[0].weight} ${unit} × ${sets.map((s) => s.reps).join(', ')}`
  return sets.map(formatSetValue).join(', ')
}
