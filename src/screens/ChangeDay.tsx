// Change a day (D-069 rules 1 to 5): the active program's days as a list,
// the current one marked, then a confirmation naming the date and both days.
// Used by Week, the day detail's "Do this today" and the deck's Plan sheet.

import { useState } from 'react'

import { Sheet } from '../builder/ui.tsx'
import { changeConfirmation, dayLabel, shortDate } from '../lib/dayChanges.ts'
import type { Day, Program } from '../types/program.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { Tick } from '../ui/shell.tsx'

function daySub(day: Day): string {
  const parts = [day.name !== dayLabel(day) ? day.name : null, day.rest ? 'Rest' : day.durationMin ? `about ${day.durationMin} min` : null]
  return parts.filter(Boolean).join(' · ')
}

export function ChangeDay({
  program,
  date,
  current,
  isToday,
  loggedToday,
  preset,
  week,
  onRestore,
  onConfirm,
  onClose,
}: {
  program: Program
  date: Date
  /** The day the date has now. */
  current: Day
  isToday: boolean
  /** Today has logged sets: the confirmation says what happens to them (rule 4). */
  loggedToday: boolean
  /** "Do this today": the day is already chosen, so only the confirmation shows. */
  preset?: Day
  /** The program week, for the sheet's sub line (2.17). */
  week?: number
  /** Put the date's own workout back; offered only when the date was changed. */
  onRestore?: () => void
  onConfirm: (dayId: string) => Promise<void> | void
  onClose: () => void
}) {
  const [chosen, setChosen] = useState<Day | null>(preset ?? null)
  const [picked, setPicked] = useState<Day>(current)
  const [busy, setBusy] = useState(false)

  if (chosen) {
    const { title, body } = changeConfirmation({ date, from: current, to: chosen, isToday, loggedToday })
    return (
      <Dialog
        title={title}
        body={body}
        confirmLabel={busy ? 'Changing…' : 'Change'}
        onCancel={onClose}
        onConfirm={() => {
          if (busy) return
          setBusy(true)
          void Promise.resolve(onConfirm(chosen.id)).finally(onClose)
        }}
      />
    )
  }

  const days = [...program.days].sort((a, b) => a.order - b.order)
  // The weekday's own workout, marked Planned (2.17).
  const planned = days.find((d) => d.order === date.getDay())
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date)
  return (
    <Sheet
      title={`Change ${isToday ? 'today' : weekday}`}
      body={[week !== undefined ? `Week ${week}` : null, planned ? `planned as ${dayLabel(planned)}` : null].filter(Boolean).join(' · ') || shortDate(date)}
      onClose={onClose}
    >
      <div className="choice-list" role="radiogroup" aria-label="Workouts">
        {days.map((day) => {
          const on = day.id === picked.id
          return (
            <button key={day.id} type="button" role="radio" aria-checked={on} className={on ? 'choice choice--on' : 'choice'} onClick={() => setPicked(day)}>
              <span className="choice__text">
                <span className="choice__title">{dayLabel(day)}</span>
                {daySub(day) && <span className="choice__sub">{daySub(day)}</span>}
              </span>
              {day.id === planned?.id && <span className="choice__tag">Planned</span>}
              <span className={on ? 'radio-v3 radio-v3--on' : 'radio-v3'} aria-hidden="true">
                {on && <Tick size={12} />}
              </span>
            </button>
          )
        })}
      </div>
      <div className="preview-actions">
        {onRestore && planned && current.id !== planned.id ? (
          <button
            type="button"
            className="btn btn--tertiary"
            onClick={() => {
              onRestore()
              onClose()
            }}
          >
            Restore {dayLabel(planned)}
          </button>
        ) : (
          <button type="button" className="btn btn--tertiary" onClick={onClose}>
            Cancel
          </button>
        )}
        <button type="button" className="btn btn--primary" disabled={picked.id === current.id} onClick={() => setChosen(picked)}>
          Save
        </button>
      </div>
    </Sheet>
  )
}
