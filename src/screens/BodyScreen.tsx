// Body (D-077 rule 1, D-078): latest values (3.06), a new or edited entry
// (3.07), history (3.08) and the empty state (4.03).

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { deleteBodyEntry, getBodyEntry, listBodyEntries, putBodyEntry } from '../db/index.ts'
import {
  BODY_FIELDS,
  byDateDesc,
  changeText,
  entryFrom,
  formatValue,
  historyLine,
  isScan,
  latestValues,
  parseBodyValue,
  unitLabel,
  valueIn,
  type BodyField,
} from '../lib/body.ts'
import { formatDayDate, formatShortDate, formatTrainContext, toISODate } from '../lib/dates.ts'
import { useProgram } from '../program/useProgram.ts'
import { unitsOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { LoadUnit } from '../types/program.ts'
import type { BodyEntry } from '../types/stores.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { AppHeader, EmptyState, ListGroup, ListRow, RowChevron } from '../ui/shell.tsx'

function useHeaderContext(): string {
  const { program, today, week } = useProgram()
  return program ? formatTrainContext(today, week) : formatTrainContext(today, 1).split(' · ')[0]
}

function useEntries(): BodyEntry[] | null {
  const [entries, setEntries] = useState<BodyEntry[] | null>(null)
  useEffect(() => {
    let live = true
    void listBodyEntries().then((found) => live && setEntries(found))
    return () => {
      live = false
    }
  }, [])
  return entries
}

function fieldOf(field: BodyField) {
  return BODY_FIELDS.find((f) => f.field === field)!
}

/** One value tile of frame 3.06. */
function Tile({ field, latest, units, wide }: { field: BodyField; latest: ReturnType<typeof latestValues>; units: LoadUnit; wide?: boolean }) {
  const meta = fieldOf(field)
  const value = latest[field]
  return (
    <div className={wide ? 'tile-v3 tile-v3--wide' : 'tile-v3'}>
      <span className="tile-v3__label">{field === 'visceralFat' ? 'Visceral fat level' : meta.label}</span>
      {value ? (
        <>
          <span className="tile-v3__value">
            <span className="tile-v3__number">{formatValue(value.value, meta.kind)}</span>
            {meta.kind !== 'level' && <span className="tile-v3__unit">{unitLabel(meta.kind, units)}</span>}
          </span>
          {value.change !== undefined && (
            <span className={value.good ? 'tile-v3__change tile-v3__change--good' : 'tile-v3__change'}>{changeText(value.change, meta.kind, units)}</span>
          )}
        </>
      ) : (
        <span className="tile-v3__none">Not logged</span>
      )}
    </div>
  )
}

/** Frames 3.06 and 4.03. */
export function BodyScreen() {
  const navigate = useNavigate()
  const context = useHeaderContext()
  const { settings, loading } = useSettings()
  const entries = useEntries()
  if (loading || entries === null) return null
  const units = unitsOf(settings)
  const header = (
    <AppHeader
      context={context}
      title="Body"
      action={entries.length > 0 ? <button type="button" className="pill-action" onClick={() => navigate('/body/new')}>Add entry</button> : undefined}
    />
  )

  if (entries.length === 0) {
    return (
      <div className="screen">
        {header}
        <EmptyState
          title="No entries yet"
          body="A scale weigh-in is one field. A full scan takes under a minute."
          action={{ label: 'Add your first entry', onClick: () => navigate('/body/new') }}
        />
        <p className="note-v3">The body score needs two entries about four weeks apart.</p>
      </div>
    )
  }

  const latest = latestValues(entries, units)
  const newest = byDateDesc(entries)[0]
  const newestScan = byDateDesc(entries).find(isScan)
  const hasComposition = (['skeletalMuscle', 'bodyFatMass', 'bodyFatPct', 'visceralFat'] as BodyField[]).some((f) => latest[f])
  const bmr = latest.bmrKcal
  const tape = BODY_FIELDS.filter((f) => f.group === 'tape' && latest[f.field])

  return (
    <div className="screen">
      {header}
      <p className="note-v3 note-v3--top">
        {newestScan ? `Latest scan ${formatDayDate(newestScan.date)}` : `Latest entry ${formatDayDate(newest.date)}`} · changes since the entry before
      </p>
      <section className="tiles-v3">
        <h2 className="lgroup__title tiles-v3__head">Scale</h2>
        <Tile field="weight" latest={latest} units={units} wide />
      </section>
      {hasComposition && (
        <section className="tiles-v3">
          <h2 className="lgroup__title tiles-v3__head">Body composition</h2>
          <Tile field="skeletalMuscle" latest={latest} units={units} />
          <Tile field="bodyFatMass" latest={latest} units={units} />
          <Tile field="bodyFatPct" latest={latest} units={units} />
          <Tile field="visceralFat" latest={latest} units={units} />
        </section>
      )}
      {bmr || tape.length > 0 ? (
        <ListGroup title="BMR and tape">
          {bmr && <ListRow title="BMR" sub={formatShortDate(bmr.date)} value={`${formatValue(bmr.value, 'kcal')} kcal/day`} />}
          {tape.map((f) => {
            const v = latest[f.field]!
            return (
              <ListRow
                key={f.field}
                title={f.label}
                sub={v.change !== undefined ? changeText(v.change, 'length', units) : formatShortDate(v.date)}
                value={`${formatValue(v.value, 'length')} ${unitLabel('length', units)}`}
              />
            )
          })}
        </ListGroup>
      ) : (
        <button type="button" className="card-v3 card-v3--row" onClick={() => navigate('/body/new')}>
          <span className="lrow__text">
            <span className="card-v3__title">BMR and tape</span>
            <span className="lrow__sub">Not logged yet. Add them with your next entry.</span>
          </span>
          <RowChevron />
        </button>
      )}
      <div className="actions-v3">
        <button type="button" className="btn btn--secondary" onClick={() => navigate('/body/history')}>
          See history
        </button>
      </div>
    </div>
  )
}

const COMPOSITION: BodyField[] = ['skeletalMuscle', 'bodyFatMass', 'bodyFatPct', 'visceralFat']
const TAPE: BodyField[] = ['waist', 'chest', 'hips', 'upperArm', 'thigh']

function BodyInput({
  field,
  units,
  text,
  error,
  onChange,
}: {
  field: BodyField
  units: LoadUnit
  text: string
  error?: string
  onChange: (text: string) => void
}) {
  const meta = fieldOf(field)
  return (
    <label className="field-v3">
      <span className="field-v3__label">{meta.label}</span>
      <span className={error ? 'field-v3__box field-v3__box--error' : 'field-v3__box'}>
        <input
          type="text"
          inputMode={meta.kind === 'level' || meta.kind === 'kcal' ? 'numeric' : 'decimal'}
          aria-label={`${meta.label}, ${unitLabel(meta.kind, units)}`}
          placeholder="Optional"
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="field-v3__unit">{unitLabel(meta.kind, units)}</span>
      </span>
      {error && <span className="field-v3__error">{error}</span>}
    </label>
  )
}

/** Frame 3.07: a new entry, or an edit when opened with ?date=. */
export function BodyEntryScreen() {
  const navigate = useNavigate()
  const context = useHeaderContext()
  const { today } = useProgram()
  const [params] = useSearchParams()
  const editing = params.get('date')
  const { settings, loading } = useSettings()
  const units = unitsOf(settings)
  const todayIso = toISODate(today)
  const [date, setDate] = useState(editing ?? todayIso)
  const [texts, setTexts] = useState<Partial<Record<BodyField, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<BodyField, string>>>({})
  const [tapeOpen, setTapeOpen] = useState(false)
  const [existing, setExisting] = useState<BodyEntry | null | undefined>(undefined)
  const [confirm, setConfirm] = useState<'replace' | 'delete' | null>(null)
  const [empty, setEmpty] = useState(false)

  // Load the entry being edited, or learn whether the chosen date already has one.
  useEffect(() => {
    let live = true
    void getBodyEntry(date).then((found) => {
      if (!live) return
      setExisting(found ?? null)
      if (editing && found && date === editing) {
        const next: Partial<Record<BodyField, string>> = {}
        for (const { field, kind } of BODY_FIELDS) {
          const value = valueIn(found, field, units)
          if (value !== undefined) next[field] = kind === 'level' || kind === 'kcal' ? String(Math.round(value)) : String(Math.round(value * 10) / 10)
        }
        setTexts(next)
        if (TAPE.some((f) => next[f])) setTapeOpen(true)
      }
    })
    return () => {
      live = false
    }
  }, [date, editing, units])

  const set = (field: BodyField) => (text: string) => {
    setTexts((t) => ({ ...t, [field]: text }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setEmpty(false)
  }

  const parsed = useMemo(() => {
    const values: Partial<Record<BodyField, number>> = {}
    const bad: Partial<Record<BodyField, string>> = {}
    for (const { field } of BODY_FIELDS) {
      const result = parseBodyValue(texts[field] ?? '')
      if (!result.ok) bad[field] = result.error
      else if (result.value !== undefined) values[field] = result.value
    }
    return { values, bad }
  }, [texts])

  async function save(confirmed = false) {
    if (Object.keys(parsed.bad).length > 0) {
      setErrors(parsed.bad)
      return
    }
    const entry = entryFrom(date, units, parsed.values, new Date())
    if (!entry) {
      setEmpty(true)
      return
    }
    // D-078 rule 1: one entry per date; a new one for a date that has one replaces it after a confirmation.
    if (existing && !confirmed && date !== editing) {
      setConfirm('replace')
      return
    }
    await putBodyEntry(entry)
    if (editing && editing !== date) await deleteBodyEntry(editing)
    navigate('/body', { replace: true })
  }

  if (loading || existing === undefined) return null
  const dateLabel = date === todayIso ? `Today, ${formatShortDate(date)}` : formatDayDate(date)

  return (
    <div className="screen screen--dock">
      <AppHeader context={context} back={{ label: editing ? 'History' : 'Body', to: editing ? '/body/history' : '/body' }} />
      <div className="page-v3 page-v3--row">
        <h1 className="page-v3__title">{editing ? 'Edit entry' : 'New entry'}</h1>
        <label className="chip date-chip">
          {dateLabel}
          <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
            <path d="M1 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input type="date" aria-label="Entry date" value={date} max={todayIso} onChange={(event) => event.target.value && setDate(event.target.value)} />
        </label>
      </div>
      <p className="page-v3__lead page-v3__lead--pad">Fill in only what you have. One entry per day.</p>

      <section className="card-v3">
        <h2 className="lgroup__title">Scale</h2>
        <div className="form-v3">
          <BodyInput field="weight" units={units} text={texts.weight ?? ''} error={errors.weight} onChange={set('weight')} />
        </div>
      </section>

      <section className="card-v3">
        <div className="card-v3__head">
          <h2 className="lgroup__title">Body composition</h2>
          <span className="card-v3__aside">From an InBody-style scan</span>
        </div>
        <div className="form-v3 form-v3--grid">
          {COMPOSITION.map((field) => (
            <BodyInput key={field} field={field} units={units} text={texts[field] ?? ''} error={errors[field]} onChange={set(field)} />
          ))}
        </div>
        <div className="form-v3">
          <BodyInput field="bmrKcal" units={units} text={texts.bmrKcal ?? ''} error={errors.bmrKcal} onChange={set('bmrKcal')} />
        </div>
      </section>

      <section className="card-v3">
        <div className="card-v3__head">
          <div>
            <div className="card-v3__title">Tape</div>
            <div className="lrow__sub card-v3__sub">Waist, chest, hips, upper arm, thigh</div>
          </div>
          {!tapeOpen && (
            <button type="button" className="chip" onClick={() => setTapeOpen(true)}>
              Add
            </button>
          )}
        </div>
        {tapeOpen && (
          <div className="form-v3 form-v3--grid">
            {TAPE.map((field) => (
              <BodyInput key={field} field={field} units={units} text={texts[field] ?? ''} error={errors[field]} onChange={set(field)} />
            ))}
          </div>
        )}
      </section>

      {editing && (
        <div className="actions-v3">
          <button type="button" className="btn btn--destructive-text" onClick={() => setConfirm('delete')}>
            Delete this entry
          </button>
        </div>
      )}
      {empty && (
        <p className="note-v3 note-v3--danger" role="alert">
          Fill in at least one value.
        </p>
      )}

      <div className="dock-v3">
        <button type="button" className="btn btn--primary" onClick={() => void save()}>
          Save entry
        </button>
      </div>

      {confirm === 'replace' && (
        <Dialog
          title={`Replace the entry for ${formatShortDate(date)}?`}
          body="There is one entry per day. Saving replaces the one already there with these values."
          confirmLabel="Replace"
          cancelLabel="Keep the old one"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            void save(true)
          }}
        />
      )}
      {confirm === 'delete' && editing && (
        <Dialog
          title={`Delete the entry for ${formatShortDate(editing)}?`}
          body="This can't be undone."
          confirmLabel="Delete"
          cancelLabel="Keep it"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            void deleteBodyEntry(editing).then(() => navigate('/body/history', { replace: true }))
          }}
        />
      )}
    </div>
  )
}

/** Frame 3.08. */
export function BodyHistoryScreen() {
  const navigate = useNavigate()
  const context = useHeaderContext()
  const { settings, loading } = useSettings()
  const entries = useEntries()
  if (loading || entries === null) return null
  const units = unitsOf(settings)
  return (
    <div className="screen">
      <AppHeader context={context} back={{ label: 'Body', to: '/body' }} />
      <div className="page-v3">
        <h1 className="page-v3__title">History</h1>
      </div>
      {entries.length === 0 ? (
        <p className="note-v3">No entries yet.</p>
      ) : (
        <>
          <ListGroup>
            {byDateDesc(entries).map((entry) => (
              <ListRow
                key={entry.date}
                title={formatDayDate(entry.date)}
                sub={historyLine(entry, units)}
                onClick={() => navigate(`/body/new?date=${entry.date}`)}
              />
            ))}
          </ListGroup>
          <p className="note-v3">Tap an entry to edit or delete it.</p>
        </>
      )}
    </div>
  )
}
