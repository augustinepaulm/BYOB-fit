// Swap with its own prescription (D-069 rule 8): after an exercise is picked,
// how to log it today, filled from that exercise elsewhere in the program or
// from the item being swapped. Nothing is stored until Log it this way.

import { useState } from 'react'

import { BuilderBar, Hero } from '../builder/ui.tsx'
import { PrimaryButton, Dock } from '../onboarding/ui.tsx'
import type { ItemFields, ItemType } from '../types/program.ts'

const TYPES: { value: ItemType; label: string }[] = [
  { value: 'load_reps', label: 'Weight and reps' },
  { value: 'bodyweight_reps', label: 'Reps' },
  { value: 'timed_hold', label: 'Timed hold' },
  { value: 'distance', label: 'Distance' },
  { value: 'cardio_block', label: 'Minutes' },
  { value: 'check', label: 'Check off' },
]

type Text = Record<'sets' | 'repMin' | 'repMax' | 'holdSec' | 'distanceM' | 'minutes' | 'restSec', string>

const str = (n: number | undefined) => (n === undefined ? '' : String(n))
const num = (t: string) => {
  const v = Number(t.trim().replace(',', '.'))
  return t.trim() === '' || !Number.isFinite(v) || v <= 0 ? undefined : v
}

export function SwapStep({
  exerciseName,
  prefill,
  from,
  onConfirm,
  onBack,
}: {
  exerciseName: string
  prefill: ItemFields
  /** Where the starting values came from, for the line under the title. */
  from: 'elsewhere' | 'swapped'
  onConfirm: (fields: ItemFields) => void
  onBack: () => void
}) {
  const [type, setType] = useState<ItemType>(prefill.type ?? 'load_reps')
  const [text, setText] = useState<Text>({
    sets: str(prefill.sets),
    repMin: str(prefill.repMin),
    repMax: str(prefill.repMax),
    holdSec: str(prefill.holdSec),
    distanceM: str(prefill.distanceM),
    minutes: str(prefill.minutes),
    restSec: str(prefill.restSec),
  })
  const field = (key: keyof Text, label: string, unit?: string) => (
    <div className="bd-field" key={key}>
      <label className="bd-label" htmlFor={`swap-${key}`}>
        {label}
      </label>
      <div className="bd-input">
        <input id={`swap-${key}`} inputMode="numeric" autoComplete="off" value={text[key]} onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))} />
        {unit && <span className="bd-input__unit">{unit}</span>}
      </div>
    </div>
  )

  function confirm() {
    // The prescription for today: the picked type, its own fields, and what
    // the prefill carried that the form does not edit (unit, per side, tempo).
    const fields: ItemFields = { ...prefill, type }
    for (const key of ['sets', 'repMin', 'repMax', 'holdSec', 'distanceM', 'minutes', 'restSec'] as const) delete fields[key]
    const sets = num(text.sets)
    if (type !== 'check' && type !== 'cardio_block' && sets !== undefined) fields.sets = Math.round(sets)
    if (type === 'load_reps' || type === 'bodyweight_reps') {
      const repMin = num(text.repMin), repMax = num(text.repMax)
      if (repMin !== undefined) fields.repMin = Math.round(repMin)
      if (repMax !== undefined) fields.repMax = Math.round(repMax)
    }
    if (type === 'timed_hold' && num(text.holdSec) !== undefined) fields.holdSec = Math.round(num(text.holdSec)!)
    if (type === 'distance' && num(text.distanceM) !== undefined) fields.distanceM = num(text.distanceM)
    if (type === 'cardio_block' && num(text.minutes) !== undefined) fields.minutes = num(text.minutes)
    if (num(text.restSec) !== undefined) fields.restSec = Math.round(num(text.restSec)!)
    if (type !== 'load_reps') delete fields.unit
    onConfirm(fields)
  }

  return (
    <div className="ob" style={{ paddingBottom: 140 }}>
      <BuilderBar title="Swap" onBack={onBack} />
      <Hero
        title="How do you want to log it today?"
        sub={`${exerciseName}, for today only. ${from === 'elsewhere' ? 'Filled from your program.' : 'Filled from the exercise it replaces.'}`}
      />
      <div className="ob-pad" style={{ margin: 0, padding: '0 24px' }}>
        <div className="bd-field">
          <label className="bd-label" htmlFor="swap-type">
            Type
          </label>
          <div className="bd-input">
            <select id="swap-type" value={type} onChange={(e) => setType(e.target.value as ItemType)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {type !== 'check' && type !== 'cardio_block' && field('sets', 'Sets')}
        {(type === 'load_reps' || type === 'bodyweight_reps') && (
          <div className="bd-cols">
            {field('repMin', 'Reps from')}
            {field('repMax', 'Reps to')}
          </div>
        )}
        {type === 'timed_hold' && field('holdSec', 'Seconds', 's')}
        {type === 'distance' && field('distanceM', 'Distance', 'm')}
        {type === 'cardio_block' && field('minutes', 'Minutes', 'min')}
        {type !== 'check' && field('restSec', 'Rest', 's')}
      </div>
      <Dock>
        <PrimaryButton onClick={confirm}>Swap for today</PrimaryButton>
      </Dock>
    </div>
  )
}
