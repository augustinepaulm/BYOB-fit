// Change a day (D-069 rules 1 to 5): the active program's days as a list,
// the current one marked, then a confirmation naming the date and both days.
// Used by Week, the day detail's "Do this today" and the deck's Plan sheet.

import { useState } from 'react'

import { Sheet } from '../builder/ui.tsx'
import { changeConfirmation, dayLabel, shortDate } from '../lib/dayChanges.ts'
import { ChoiceRow } from '../onboarding/ui.tsx'
import type { Day, Program } from '../types/program.ts'
import { Dialog } from '../ui/Dialog.tsx'

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
  onConfirm: (dayId: string) => Promise<void> | void
  onClose: () => void
}) {
  const [chosen, setChosen] = useState<Day | null>(preset ?? null)
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
  return (
    <Sheet title={`Change ${shortDate(date)}`} body="Pick the workout for this date. Nothing else moves." onClose={onClose}>
      <div className="wk-change-list" role="radiogroup" aria-label="Workouts">
        {days.map((day) => (
          <ChoiceRow
            key={day.id}
            compact
            title={dayLabel(day)}
            sub={daySub(day)}
            badge={day.id === current.id ? 'Now' : undefined}
            on={day.id === current.id}
            onClick={() => (day.id === current.id ? undefined : setChosen(day))}
          />
        ))}
      </div>
      <button type="button" className="ob-outline" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  )
}
