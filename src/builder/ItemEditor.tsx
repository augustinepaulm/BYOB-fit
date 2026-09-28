// Frame 2h (item editor) and 2i (retire an item with history). The editor
// works on a copy; Save hands the edited base item back. byWeek overrides
// are shown as a count and never edited (D-042 rule 5).

import { useState } from 'react'

import {
  TYPE_FIELDS,
  TYPE_LABEL,
  exerciseMeta,
  itemErrors,
  withType,
} from '../lib/builder.ts'
import { Stepper } from '../onboarding/ui.tsx'
import type { Item, ItemFields, ItemType, Program } from '../types/program.ts'
import { AppbarAction, BuilderBar, Chip, Demo, Sheet, Switch } from './ui.tsx'

const TYPES = Object.keys(TYPE_LABEL) as ItemType[]

function toNumber(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  return Number(trimmed)
}

function NumberField({
  id,
  label,
  unit,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  unit?: string
  value: number | undefined
  error?: string
  onChange: (value: number | undefined) => void
}) {
  const [text, setText] = useState(value === undefined || Number.isNaN(value) ? '' : String(value))
  return (
    <div className="bd-field">
      <label className={error ? 'bd-label bd-label--error' : 'bd-label'} htmlFor={id}>
        {label}
      </label>
      <div className={error ? 'bd-input bd-input--error' : 'bd-input'}>
        <input
          id={id}
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onChange(toNumber(e.target.value))
          }}
        />
        {unit && <span className="bd-input__unit">{unit}</span>}
      </div>
      {error && <div className="bd-error">{error}</div>}
    </div>
  )
}

export function ItemEditor({
  program,
  item,
  hasHistory,
  weeksLogged,
  onSave,
  onRemove,
  onChangeExercise,
  onBack,
}: {
  program: Program
  item: Item
  hasHistory: boolean
  weeksLogged: number
  onSave: (item: Item) => void
  onRemove: () => void
  onChangeExercise: (edited: Item) => void
  onBack: () => void
}) {
  const [edit, setEdit] = useState<Item>(item)
  const [retiring, setRetiring] = useState(false)
  const exercise = program.exercises[edit.exerciseId]
  const name = exercise?.name ?? edit.exerciseId
  const errors = itemErrors(edit)
  const fields = new Set<keyof ItemFields>(TYPE_FIELDS[edit.type])
  const later = Object.keys(item.byWeek ?? {}).length
  const set = (patch: Partial<Item>) => setEdit((e) => ({ ...e, ...patch }))
  const setField = (key: keyof ItemFields, value: number | undefined) =>
    setEdit((e) => {
      const next = { ...e } as Record<string, unknown>
      if (value === undefined) delete next[key]
      else next[key] = value
      return next as unknown as Item
    })
  const repsError = errors.repMin ?? errors.repMax

  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar
        title={name}
        draft
        onBack={onBack}
        right={
          <AppbarAction disabled={Object.keys(errors).length > 0} onClick={() => onSave(edit)}>
            Save
          </AppbarAction>
        }
      />
      <div className="bd-item-head">
        <Demo large />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bd-item-head__name">{name}</div>
          {exercise && exerciseMeta(exercise) && <div className="bd-ex__sub">{exerciseMeta(exercise)}</div>}
        </div>
        <button type="button" className="bd-change" onClick={() => onChangeExercise(edit)}>
          Change
        </button>
      </div>

      <div className="ob-pad">
        <div className="bd-label" style={{ margin: '16px 0 8px' }}>
          Type
        </div>
        <div className="bd-chips" role="radiogroup" aria-label="Type">
          {TYPES.map((type) => (
            <Chip key={type} on={edit.type === type} onClick={() => setEdit((e) => withType(e, type))}>
              {TYPE_LABEL[type]}
            </Chip>
          ))}
        </div>

        {(fields.has('sets') || fields.has('repMin')) && (
          <div className="bd-cols" style={{ alignItems: 'flex-start' }}>
            {fields.has('sets') && (
              <div style={{ flex: 'none' }}>
                <div className={errors.sets ? 'bd-label bd-label--error' : 'bd-label'} style={{ margin: '18px 0 6px' }}>
                  Sets
                </div>
                <Stepper label="Sets" value={edit.sets ?? 1} onChange={(v) => set({ sets: v })} />
              </div>
            )}
            {fields.has('repMin') && (
              <div className="bd-field">
                <div className={repsError ? 'bd-label bd-label--error' : 'bd-label'}>Reps, from – to</div>
                <div className={repsError ? 'bd-input bd-input--error' : 'bd-input'}>
                  <input
                    aria-label="Reps from"
                    inputMode="numeric"
                    defaultValue={edit.repMin ?? ''}
                    onChange={(e) => setField('repMin', toNumber(e.target.value))}
                    style={{ width: 40, flex: 'none' }}
                  />
                  <span>–</span>
                  <input
                    aria-label="Reps to"
                    inputMode="numeric"
                    defaultValue={edit.repMax ?? ''}
                    onChange={(e) => setField('repMax', toNumber(e.target.value))}
                  />
                </div>
                {repsError && <div className="bd-error">{repsError}</div>}
              </div>
            )}
          </div>
        )}

        {fields.has('holdSec') && (
          <NumberField id="hold" label="Hold" unit="s" value={edit.holdSec} error={errors.holdSec} onChange={(v) => setField('holdSec', v)} />
        )}
        {fields.has('distanceM') && (
          <NumberField id="distance" label="Distance" unit="m" value={edit.distanceM} error={errors.distanceM} onChange={(v) => setField('distanceM', v)} />
        )}
        {fields.has('minutes') && (
          <NumberField id="minutes" label="Minutes" unit="min" value={edit.minutes} error={errors.minutes} onChange={(v) => setField('minutes', v)} />
        )}

        {(fields.has('restSec') || fields.has('tempo')) && (
          <div className="bd-cols">
            {fields.has('restSec') && (
              <div>
                <NumberField id="rest" label="Rest" unit="s" value={edit.restSec} error={errors.restSec} onChange={(v) => setField('restSec', v)} />
              </div>
            )}
            {fields.has('tempo') && (
              <div>
                <div className="bd-field">
                  <label className="bd-label" htmlFor="tempo">
                    Tempo
                  </label>
                  <div className="bd-input">
                    <input
                      id="tempo"
                      placeholder="Optional"
                      value={edit.tempo ?? ''}
                      onChange={(e) => {
                        const tempo = e.target.value
                        setEdit((cur) => {
                          const next = { ...cur }
                          if (tempo.trim() === '') delete next.tempo
                          else next.tempo = tempo
                          return next
                        })
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {fields.has('perSide') && (
          <div className="bd-toggle-row">
            <span>Per side</span>
            <Switch
              label="Per side"
              on={edit.perSide === true}
              onChange={(on) =>
                setEdit((cur) => {
                  const next = { ...cur }
                  if (on) next.perSide = true
                  else delete next.perSide
                  return next
                })
              }
            />
          </div>
        )}

        {later > 0 && <div className="bd-hint" style={{ marginTop: 14 }}>Changes in later weeks: {later}. Those stay as they are.</div>}

        <button type="button" className="bd-danger-link" onClick={() => (hasHistory ? setRetiring(true) : onRemove())}>
          Remove from this day
        </button>
      </div>

      {retiring && (
        <Sheet
          title="Retire this exercise?"
          body={`${name} has ${weeksLogged} ${weeksLogged === 1 ? 'week' : 'weeks'} of history. Your history is kept. It won't appear on future days, but stays in the Log.`}
          onClose={() => setRetiring(false)}
        >
          <button type="button" className="bd-danger" onClick={onRemove}>
            Retire exercise
          </button>
          <button type="button" className="ob-outline" onClick={() => setRetiring(false)}>
            Cancel
          </button>
        </Sheet>
      )}
    </div>
  )
}
