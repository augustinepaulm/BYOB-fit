// D-077 rule 3: while a workout is open and the user is on another screen, a
// sage bar above the tabs shows the workout and any running rest; tapping it
// returns to the deck where the user left (frame 2.18).

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { getSessionByDateAndDay } from '../db/index.ts'
import { formatClock } from '../lib/prescription.ts'
import { toISODate } from '../lib/dates.ts'
import { dayForDate } from '../lib/program.ts'
import { sessionIdFor } from '../lib/session.ts'
import { useProgram } from '../program/useProgram.ts'
import { tabFor } from './tabs.ts'
import { onDeckStateChange, readDeckState, type DeckState } from '../session/deckState.ts'

interface Open {
  name: string
  kept: DeckState | null
}

export function InProgressBar() {
  const { program, today, changes } = useProgram()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState<Open | null>(null)
  const [now, setNow] = useState(Date.now)
  const [version, setVersion] = useState(0)

  const day = program ? dayForDate(program, changes, today) : null
  const date = toISODate(today)
  // Task 4: the bar shows on the other tabs; Train has the deck and Today's own card (2.02).
  const onTrain = tabFor(pathname) === 'train'

  useEffect(() => onDeckStateChange(() => setVersion((v) => v + 1)), [])

  useEffect(() => {
    if (!day || day.rest || onTrain) return
    let live = true
    void Promise.all([getSessionByDateAndDay(date, day.id), readDeckState(sessionIdFor(date, day.id))]).then(
      ([session, kept]) => {
        if (!live) return
        const running = session && session.startedAt && !session.endedAt
        setOpen(running ? { name: day.focus ?? day.name, kept } : null)
      },
    )
    return () => {
      live = false
    }
  }, [day, date, onTrain, pathname, version])

  const restUntil = open?.kept?.restUntil ?? null
  const resting = restUntil !== null && restUntil > now
  useEffect(() => {
    if (!resting) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [resting])

  if (!open || onTrain || !day || day.rest) return null
  const remaining = resting ? (restUntil - now) / 1000 : 0
  const total = open.kept?.restSec ?? 0
  const fraction = resting && total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const C = 314

  return (
    <button
      type="button"
      className="inprogress"
      onClick={() => navigate('/deck', { state: { fromToday: true } })}
      aria-label={`Return to ${open.name}`}
    >
      <span className="inprogress__ring" aria-hidden="true">
        <svg width="38" height="38" viewBox="0 0 120 120">
          <circle className="inprogress__track" cx="60" cy="60" r="50" fill="none" strokeWidth="14" />
          <circle
            className="inprogress__fill"
            cx="60"
            cy="60"
            r="50"
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={(C * (1 - fraction)).toFixed(1)}
            transform="rotate(-90 60 60)"
          />
        </svg>
      </span>
      <span className="inprogress__text">
        <span className="inprogress__title">
          {open.name}
          {resting && ` · rest ${formatClock(remaining)}`}
        </span>
        {open.kept?.label && <span className="inprogress__sub">{open.kept.label}</span>}
      </span>
      <span className="inprogress__return">
        Return
        <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
          <path d="M3 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  )
}
