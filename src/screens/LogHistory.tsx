// Exercise history in Log with Edit (D-069 rule 10): each logged set of an
// ended session can be retyped in the deck's boxes (D-051, D-053). Confirm
// records the edit time; Cancel changes nothing. The edited values become the
// next reference.

import { useState } from 'react'

import { saveSession } from '../db/index.ts'
import { formatSetValue } from '../lib/prescription.ts'
import { parseISODate } from '../lib/program.ts'
import { editLoggedSet, loggedSetsOf, replaceSet } from '../lib/sessionExercises.ts'
import type { ItemType } from '../types/program.ts'
import type { Session, SetLog } from '../types/stores.ts'

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** How a stored set reads: by the values it holds, so retired and swapped items still edit. */
function typeOfSet(set: SetLog): ItemType {
  if (set.weight !== undefined) return 'load_reps'
  if (set.seconds !== undefined) return 'timed_hold'
  if (set.distanceM !== undefined) return 'distance'
  if (set.minutes !== undefined) return 'cardio_block'
  return 'bodyweight_reps'
}

const UNIT: Partial<Record<ItemType, string>> = { bodyweight_reps: 'reps', timed_hold: 's', distance: 'm', cardio_block: 'min' }
const VALUE: Partial<Record<ItemType, keyof SetLog>> = { bodyweight_reps: 'reps', timed_hold: 'seconds', distance: 'distanceM', cardio_block: 'minutes' }

type Editing = { sessionId: string; itemId: string; set: SetLog; weight: string; reps: string; value: string; errors: Record<string, string> }

export function LogHistory({ sessions, exerciseId, onSaved }: { sessions: Session[]; exerciseId: string; onSaved: () => void }) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const withSets = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
    .map((session) => ({ session, sets: loggedSetsOf(session, exerciseId) }))
    .filter((s) => s.sets.length > 0)

  async function confirm(session: Session) {
    if (!editing) return
    const type = typeOfSet(editing.set)
    const result = editLoggedSet(editing.set, type, editing, new Date())
    if (!result.ok) {
      setEditing({ ...editing, errors: result.errors })
      return
    }
    await saveSession(replaceSet(session, editing.itemId, result.set))
    setEditing(null)
    onSaved()
  }

  return (
    <>
      {withSets.map(({ session, sets }) => (
        <div className="lg-hist" key={session.id}>
          <div className="lg-hist__date">{MONTH_DAY.format(parseISODate(session.date))}</div>
          {sets.map(({ entry, set }) => {
            const key = `${session.id}:${entry.itemId}:${set.n}:${set.side ?? ''}`
            const open = editing?.sessionId === session.id && editing.itemId === entry.itemId && editing.set.n === set.n && (editing.set.side ?? '') === (set.side ?? '')
            const type = typeOfSet(set)
            if (open && editing) {
              const field = (name: 'weight' | 'reps' | 'value', label: string, unit: string, inputMode: 'decimal' | 'numeric') => (
                <div className="dk-boxcol">
                  <div className={`dk-field dk-field--box ${editing.errors[name] ? 'dk-field--error' : 'dk-field--active'}`}>
                    <input
                      id={`edit-${key}-${name}`}
                      name={`edit-${name}`}
                      type="text"
                      inputMode={inputMode}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-label={`${label}, set ${set.n}${set.side ? ` ${set.side}` : ''}`}
                      value={editing[name]}
                      onChange={(e) => setEditing({ ...editing, [name]: e.target.value, errors: { ...editing.errors, [name]: '' } })}
                    />
                    <span className="dk-field__unit">{unit}</span>
                  </div>
                  {editing.errors[name] && <div className="dk-box-error" role="alert">{editing.errors[name]}</div>}
                </div>
              )
              return (
                <div className="lg-hist__edit" key={key}>
                  <div className="dk-set__row dk-set__row--boxes">
                    <span className="dk-set__n">{set.n}{set.side ?? ''}</span>
                    {type === 'load_reps' ? (
                      <>
                        {field('weight', 'Weight', '', 'decimal')}
                        {field('reps', 'Reps', 'reps', 'numeric')}
                      </>
                    ) : (
                      field('value', 'Value', UNIT[type] ?? '', type === 'distance' ? 'decimal' : 'numeric')
                    )}
                  </div>
                  <div className="ai-banner__actions">
                    <button type="button" className="ai-btn ai-btn--primary" onClick={() => void confirm(session)}>
                      Save
                    </button>
                    <button type="button" className="ai-btn" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )
            }
            return (
              <div className="lg-hist__set" key={key}>
                <span className="lg-hist__n">{set.n}{set.side ?? ''}</span>
                <span className="lg-hist__value">{formatSetValue(set)}</span>
                {set.editedAt && <span className="lg-hist__edited">edited</span>}
                {session.endedAt && (
                  <button
                    type="button"
                    className="lg-hist__edit-btn"
                    aria-label={`Edit set ${set.n}${set.side ? ` ${set.side}` : ''}, ${MONTH_DAY.format(parseISODate(session.date))}`}
                    onClick={() =>
                      setEditing({
                        sessionId: session.id,
                        itemId: entry.itemId,
                        set,
                        weight: set.weight !== undefined ? String(set.weight) : '',
                        reps: set.reps !== undefined ? String(set.reps) : '',
                        value: VALUE[type] && set[VALUE[type]!] !== undefined ? String(set[VALUE[type]!]) : '',
                        errors: {},
                      })
                    }
                  >
                    Edit
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}
