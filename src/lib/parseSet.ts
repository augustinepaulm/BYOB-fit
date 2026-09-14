// Free-text set parser (D-011, PLAN section 5 grammar). One text field per row
// accepts typing or iOS keyboard dictation; anything it cannot read is returned
// as `raw` so the row can be flagged. It never invents a zero.

import type { ItemType } from '../types/program.ts'
import type { SetLog } from '../types/stores.ts'

export type ParsedFields = Pick<
  SetLog,
  'weight' | 'reps' | 'seconds' | 'distanceM' | 'minutes'
>

export type ParseResult =
  | { ok: true; fields: ParsedFields }
  | { ok: false; raw: string }

export interface ParseContext {
  type: ItemType
  /** The set "same" copies. */
  reference?: SetLog
  /**
   * The load a bare number inherits on a load_reps row: the nearest confirmed
   * set above it in this session, else the last-week reference (EXEC-04 2a).
   */
  inheritWeight?: number
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
}

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
}

/** Spoken numbers to digits: "twenty two point five" → "22.5". */
export function normaliseNumbers(input: string): string {
  const tokens = input
    .toLowerCase()
    .replace(/×/g, ' x ')
    .replace(/[,]/g, ' ')
    // Hyphenated tens ("twenty-two") and digit forms ("22.5") both survive.
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const out: string[] = []
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    let value: number | null = null

    if (token in TENS) {
      value = TENS[token]
      i++
      if (i < tokens.length && tokens[i] in UNITS && UNITS[tokens[i]] < 10 && UNITS[tokens[i]] > 0) {
        value += UNITS[tokens[i]]
        i++
      }
    } else if (token in UNITS) {
      value = UNITS[token]
      i++
    } else if (/^\d+(?:\.\d+)?$/.test(token)) {
      value = Number(token)
      i++
    }

    if (value === null) {
      out.push(token)
      i++
      continue
    }

    // "a hundred", "two hundred"
    while (i < tokens.length && tokens[i] === 'hundred') {
      value = (value === 0 ? 1 : value) * 100
      i++
    }

    // "point five", "point two five"
    if (i < tokens.length && tokens[i] === 'point') {
      const digits: string[] = []
      let j = i + 1
      while (j < tokens.length) {
        const t = tokens[j]
        if (t in UNITS && UNITS[t] <= 9) digits.push(String(UNITS[t]))
        else if (/^\d$/.test(t)) digits.push(t)
        else break
        j++
      }
      if (digits.length > 0) {
        value = Number(`${value}.${digits.join('')}`)
        i = j
      }
    }

    // "and a half", "and a quarter"
    if (
      i + 2 < tokens.length &&
      tokens[i] === 'and' &&
      tokens[i + 1] === 'a' &&
      (tokens[i + 2] === 'half' || tokens[i + 2] === 'quarter')
    ) {
      value += tokens[i + 2] === 'half' ? 0.5 : 0.25
      i += 3
    } else if (i < tokens.length && (tokens[i] === 'half' || tokens[i] === 'quarter')) {
      // "sixty two half" — dictation often drops "and a".
      value += tokens[i] === 'half' ? 0.5 : 0.25
      i++
    }

    out.push(String(value))
  }
  return out.join(' ')
}

/** Everything that means "weight times reps". */
const TIMES = String.raw`(?:for|x|by|times|\*|@)`
const NUM = String.raw`(\d+(?:\.\d+)?)`

function fields(partial: ParsedFields): { ok: true; fields: ParsedFields } {
  return { ok: true, fields: partial }
}

export function parseSet(input: string, context: ParseContext): ParseResult {
  const raw = input.trim()
  if (raw === '') return { ok: false, raw }

  let text = normaliseNumbers(raw)
    // The item carries the unit; a spoken "kg"/"lb" is noise here.
    .replace(/\b(kg|kgs|kilo|kilos|kilogram|kilograms|lb|lbs|pound|pounds)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // "same" copies the reference set outright.
  if (/^same(?:\s+again)?$/.test(text)) {
    const reference = context.reference
    if (!reference) return { ok: false, raw }
    return fields({
      weight: reference.weight,
      reps: reference.reps,
      seconds: reference.seconds,
      distanceM: reference.distanceM,
      minutes: reference.minutes,
    })
  }

  // bodyweight / bw → an explicit zero load, never an implied one.
  const bodyweight = /\b(bodyweight|body weight|bw)\b/.test(text)
  if (bodyweight) {
    text = text.replace(/\b(bodyweight|body weight|bw)\b/g, '0').replace(/\s+/g, ' ').trim()
    if (text === '0') return fields({ weight: 0 })
  }

  let match: RegExpMatchArray | null

  // Order matters: "min" before "m", "sec" before "s".
  if ((match = text.match(new RegExp(`^${NUM}\\s*(?:min|mins|minute|minutes)$`)))) {
    return fields({ minutes: Number(match[1]) })
  }
  if ((match = text.match(new RegExp(`^${NUM}\\s*(?:s|sec|secs|second|seconds)$`)))) {
    return fields({ seconds: Number(match[1]) })
  }
  if ((match = text.match(new RegExp(`^${NUM}\\s*(?:m|meter|meters|metre|metres)$`)))) {
    return fields({ distanceM: Number(match[1]) })
  }
  if ((match = text.match(new RegExp(`^${NUM}\\s*(?:reps?)$`)))) {
    return fields({ reps: Number(match[1]) })
  }
  // "60 for 8", "60 x 8", "sixty by eight"
  if ((match = text.match(new RegExp(`^${NUM}\\s*${TIMES}\\s*${NUM}$`)))) {
    return fields({ weight: Number(match[1]), reps: Number(match[2]) })
  }
  // "45 seconds per side" and similar trailing qualifiers are handled by the
  // row's own side, so strip a trailing "per side" and retry once.
  if (/\bper side\b/.test(text)) {
    return parseSet(text.replace(/\bper side\b/, '').trim(), context)
  }

  // A bare number means different things by item type.
  if ((match = text.match(new RegExp(`^${NUM}$`)))) {
    const value = Number(match[1])
    // Reps are integers in the schema, so a fractional bare number is never a
    // rep count: "sixty two half" is a misheard load, not 62.5 reps.
    const wholeReps = Number.isInteger(value) && value > 0
    switch (context.type) {
      case 'bodyweight_reps':
        return wholeReps ? fields({ reps: value }) : { ok: false, raw }
      case 'timed_hold':
        return fields({ seconds: value })
      case 'distance':
        return fields({ distanceM: value })
      case 'cardio_block':
        return fields({ minutes: value })
      case 'load_reps':
        // A bare number is the rep count; the load carries over from the row
        // above or from last week. With no load to inherit, flag it.
        if (!wholeReps || context.inheritWeight === undefined) {
          return { ok: false, raw }
        }
        return fields({ weight: context.inheritWeight, reps: value })
      case 'check':
      default:
        return { ok: false, raw }
    }
  }

  return { ok: false, raw }
}
