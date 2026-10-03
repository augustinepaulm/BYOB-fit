// Body log (D-078, frames 3.06 to 3.08). Pure: fields, units, latest values
// and the change since the entry before.

import type { LoadUnit } from '../types/program.ts'
import type { BodyEntry } from '../types/stores.ts'

export type BodyField =
  | 'weight'
  | 'skeletalMuscle'
  | 'bodyFatMass'
  | 'bodyFatPct'
  | 'visceralFat'
  | 'bmrKcal'
  | 'waist'
  | 'chest'
  | 'hips'
  | 'upperArm'
  | 'thigh'

export type FieldKind = 'mass' | 'percent' | 'level' | 'kcal' | 'length'

export const BODY_FIELDS: { field: BodyField; label: string; kind: FieldKind; group: 'scale' | 'composition' | 'tape' }[] = [
  { field: 'weight', label: 'Weight', kind: 'mass', group: 'scale' },
  { field: 'skeletalMuscle', label: 'Skeletal muscle', kind: 'mass', group: 'composition' },
  { field: 'bodyFatMass', label: 'Body fat mass', kind: 'mass', group: 'composition' },
  { field: 'bodyFatPct', label: 'Body fat', kind: 'percent', group: 'composition' },
  { field: 'visceralFat', label: 'Visceral fat', kind: 'level', group: 'composition' },
  { field: 'bmrKcal', label: 'BMR', kind: 'kcal', group: 'composition' },
  { field: 'waist', label: 'Waist', kind: 'length', group: 'tape' },
  { field: 'chest', label: 'Chest', kind: 'length', group: 'tape' },
  { field: 'hips', label: 'Hips', kind: 'length', group: 'tape' },
  { field: 'upperArm', label: 'Upper arm', kind: 'length', group: 'tape' },
  { field: 'thigh', label: 'Thigh', kind: 'length', group: 'tape' },
]

export const LB_TO_KG = 0.45359237
export const CM_PER_IN = 2.54

/** D-078 rule 2: masses in the display unit; lengths in cm with kg and inches with lb. */
export function unitLabel(kind: FieldKind, units: LoadUnit): string {
  switch (kind) {
    case 'mass':
      return units
    case 'percent':
      return '%'
    case 'level':
      return 'level'
    case 'kcal':
      return 'kcal/day'
    case 'length':
      return units === 'lb' ? 'in' : 'cm'
  }
}

/** A stored value in the units the user now reads. */
export function convert(value: number, kind: FieldKind, from: LoadUnit, to: LoadUnit): number {
  if (from === to) return value
  if (kind === 'mass') return from === 'kg' ? value / LB_TO_KG : value * LB_TO_KG
  if (kind === 'length') return from === 'kg' ? value / CM_PER_IN : value * CM_PER_IN
  return value
}

/** A field's value from an entry, in the display units; undefined when not entered. */
export function valueIn(entry: BodyEntry, field: BodyField, units: LoadUnit): number | undefined {
  const raw = entry[field]
  if (raw === undefined) return undefined
  const kind = BODY_FIELDS.find((f) => f.field === field)!.kind
  return convert(raw, kind, entry.units, units)
}

export function formatValue(value: number, kind: FieldKind): string {
  if (kind === 'level' || kind === 'kcal') return String(Math.round(value))
  return value.toFixed(1)
}

/** Newest first. */
export function byDateDesc(entries: BodyEntry[]): BodyEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))
}

export interface LatestValue {
  field: BodyField
  value: number
  date: string
  /** Against the most recent earlier entry with this field; undefined with none. */
  change?: number
  /** Whether the change is in the healthy direction (muscle up, fat down); null when neutral. */
  good: boolean | null
}

const UP_IS_GOOD: Partial<Record<BodyField, boolean>> = {
  skeletalMuscle: true,
  bodyFatMass: false,
  bodyFatPct: false,
  visceralFat: false,
}

/** Each field's latest value and its change since the entry before that had it. */
export function latestValues(entries: BodyEntry[], units: LoadUnit): Partial<Record<BodyField, LatestValue>> {
  const sorted = byDateDesc(entries)
  const out: Partial<Record<BodyField, LatestValue>> = {}
  for (const { field } of BODY_FIELDS) {
    const withField = sorted.filter((e) => e[field] !== undefined)
    if (withField.length === 0) continue
    const value = valueIn(withField[0], field, units)!
    const before = withField[1] ? valueIn(withField[1], field, units) : undefined
    const change = before === undefined ? undefined : Math.round((value - before) * 10) / 10
    const upGood = UP_IS_GOOD[field]
    out[field] = {
      field,
      value,
      date: withField[0].date,
      ...(change !== undefined ? { change } : {}),
      good: change === undefined || change === 0 || upGood === undefined ? null : upGood ? change > 0 : change < 0,
    }
  }
  return out
}

/** "−0.4 kg", "+0.3 points", "No change". */
export function changeText(change: number, kind: FieldKind, units: LoadUnit): string {
  if (change === 0) return 'No change'
  const sign = change > 0 ? '+' : '−'
  const amount = formatValue(Math.abs(change), kind)
  if (kind === 'percent') return `${sign}${amount} points`
  if (kind === 'level') return `${sign}${amount}`
  return `${sign}${amount} ${unitLabel(kind, units)}`
}

/** Whether an entry holds any composition field: a scan rather than a weigh-in. */
export function isScan(entry: BodyEntry): boolean {
  return ['skeletalMuscle', 'bodyFatMass', 'bodyFatPct', 'visceralFat', 'bmrKcal'].some((f) => entry[f as BodyField] !== undefined)
}

/** History line, frame 3.08: "Scan · 83.0 kg · muscle 34.2 · fat 18.6" or "Weight 83.4 kg". */
export function historyLine(entry: BodyEntry, units: LoadUnit): string {
  const v = (field: BodyField) => valueIn(entry, field, units)
  const weight = v('weight')
  if (isScan(entry)) {
    const parts = ['Scan']
    if (weight !== undefined) parts.push(`${formatValue(weight, 'mass')} ${units}`)
    const muscle = v('skeletalMuscle')
    if (muscle !== undefined) parts.push(`muscle ${formatValue(muscle, 'mass')}`)
    const fat = v('bodyFatMass')
    if (fat !== undefined) parts.push(`fat ${formatValue(fat, 'mass')}`)
    else if (entry.bodyFatPct !== undefined) parts.push(`fat ${formatValue(entry.bodyFatPct, 'percent')}%`)
    return parts.join(' · ')
  }
  const parts: string[] = []
  if (weight !== undefined) parts.push(`Weight ${formatValue(weight, 'mass')} ${units}`)
  const tape = BODY_FIELDS.filter((f) => f.group === 'tape' && entry[f.field] !== undefined)
  if (tape.length) parts.push(tape.map((f) => `${f.label.toLowerCase()} ${formatValue(v(f.field)!, 'length')}`).join(', '))
  return parts.join(' · ') || 'No values'
}

/** Parse a typed box: empty is "not entered"; anything else must be a positive number. */
export function parseBodyValue(text: string): { ok: true; value: number | undefined } | { ok: false; error: string } {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return { ok: true, value: undefined }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: 'Enter a number above 0' }
  return { ok: true, value }
}

/** Build an entry from typed values; undefined when nothing was entered (every field optional, but not all empty). */
export function entryFrom(date: string, units: LoadUnit, values: Partial<Record<BodyField, number>>, now: Date): BodyEntry | undefined {
  const entry: BodyEntry = { date, units, updatedAt: now.toISOString() }
  let any = false
  for (const { field } of BODY_FIELDS) {
    const value = values[field]
    if (value !== undefined) {
      entry[field] = value
      any = true
    }
  }
  return any ? entry : undefined
}

/** D-078 rule 3: an entered BMR no more than 8 weeks old (MODELED). */
export const BMR_MAX_AGE_DAYS = 56

/** The newest BMR entered within 8 weeks of `today` (YYYY-MM-DD), if any. */
export function recentBmr(entries: BodyEntry[], today: string): { kcal: number; date: string } | undefined {
  const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000
  const found = byDateDesc(entries).find((e) => e.bmrKcal !== undefined && e.date <= today)
  if (!found) return undefined
  return day(today) - day(found.date) <= BMR_MAX_AGE_DAYS ? { kcal: found.bmrKcal!, date: found.date } : undefined
}
