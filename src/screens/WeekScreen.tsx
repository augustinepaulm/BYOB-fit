import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { listSessionsBetween } from '../db/index.ts'
import {
  formatDayOrder,
  formatShortDay,
  formatWeekRange,
  isSameDate,
  toISODate,
} from '../lib/dates.ts'
import { dayForDate, weekDates } from '../lib/program.ts'
import {
  buildDeck,
  restDayState,
  sessionState,
  type DayState,
} from '../lib/session.ts'
import { useProgram } from '../program/useProgram.ts'
import type { Day, Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { ReviewBanner } from '../ai/parts.tsx'
import { Sheet } from '../builder/ui.tsx'
import { CheckIcon, ChevronRightIcon, SwapIcon } from '../ui/icons.tsx'

function StateMark({ state }: { state: DayState }) {
  if (state === 'done') {
    return (
      <span className="state state--done">
        <CheckIcon />
        Done
      </span>
    )
  }
  if (state === 'partial') {
    return (
      <span className="state state--partial">
        <span className="dot dot--partial" />
        Partial
      </span>
    )
  }
  return <span className="dot dot--idle" />
}

/** Days that may trade places with `day`, per swappableWith in both directions. */
function partnersOf(program: Program, day: Day): Day[] {
  return program.days.filter(
    (other) =>
      other.id !== day.id &&
      (other.id === day.swappableWith || other.swappableWith === day.id),
  )
}

function SwapSheet({
  program,
  onClose,
  onConfirm,
}: {
  program: Program
  onClose: () => void
  onConfirm: (a: string, b: string) => void
}) {
  const [first, setFirst] = useState<Day | null>(null)
  const [second, setSecond] = useState<Day | null>(null)

  const swappable = program.days.filter((d) => partnersOf(program, d).length > 0)
  const eligible = first ? partnersOf(program, first) : swappable

  function pick(day: Day) {
    if (first && !second) {
      if (day.id === first.id) {
        setFirst(null)
        return
      }
      setSecond(day)
      return
    }
    setFirst(day)
    setSecond(null)
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet__grip" />
        <div className="sheet__title">Swap two days</div>
        <div className="sheet__body">
          Sessions trade places; logs stay with the session
        </div>
        <div className="swap-pair">
          <div className={first ? 'swap-slot swap-slot--filled' : 'swap-slot'}>
            <div className="swap-slot__dow">{first ? formatDayOrder(first.order) : 'Pick one'}</div>
            <div className="swap-slot__name">{first?.name ?? ''}</div>
          </div>
          <SwapIcon size={20} />
          <div className={second ? 'swap-slot swap-slot--filled' : 'swap-slot'}>
            <div className="swap-slot__dow">{second ? formatDayOrder(second.order) : 'Pick one'}</div>
            <div className="swap-slot__name">{second?.name ?? ''}</div>
          </div>
        </div>
        <div className="chips">
          {program.days.map((day) => {
            const on = day.id === first?.id || day.id === second?.id
            const allowed = on || eligible.some((d) => d.id === day.id)
            return (
              <button
                type="button"
                key={day.id}
                className={on ? 'chip chip--on' : 'chip'}
                disabled={!allowed}
                onClick={() => pick(day)}
              >
                {formatDayOrder(day.order)}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="sheet__confirm"
          disabled={!first || !second}
          onClick={() => first && second && onConfirm(first.id, second.id)}
        >
          {first && second
            ? `Swap ${formatDayOrder(first.order)} and ${formatDayOrder(second.order)}`
            : 'Swap'}
        </button>
      </div>
    </div>
  )
}

export function WeekScreen() {
  const { program, today, week, weekPlan, applySwap } = useProgram()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)

  const dates = useMemo(
    () => (program ? weekDates(program, week) : []),
    [program, week],
  )

  useEffect(() => {
    if (dates.length === 0) return
    let live = true
    void listSessionsBetween(
      toISODate(dates[0]),
      toISODate(dates[dates.length - 1]),
    ).then((found) => {
      if (live) setSessions(found)
    })
    return () => {
      live = false
    }
  }, [dates])

  if (!program) return null

  const byDayId = new Map(sessions.map((s) => [s.dayId, s]))
  // D-027: Ask AI needs at least one finished session this week.
  const finished = sessions.filter((session) => session.endedAt).length
  const training = program.days.filter((d) => !d.rest).length

  return (
    <div className="page">
      <div className="page-head page-head--split">
        <div>
          <div className="page-head__meta">{formatWeekRange(dates)}</div>
          <h1 className="page-title">
            Week {week} of {program.programWeeks}
          </h1>
        </div>
        <button
          type="button"
          className="pill-btn"
          onClick={() => setSheetOpen(true)}
        >
          <SwapIcon size={14} />
          Swap days
        </button>
      </div>

      <ReviewBanner program={program} />

      <div className="day-list">
        {dates.map((date) => {
          const day = dayForDate(program, weekPlan, date)
          const isToday = isSameDate(date, today)
          const meta = [
            day.focus,
            day.durationMin ? `${day.durationMin} min` : null,
            isToday ? 'today' : null,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <div
              key={toISODate(date)}
              className={isToday ? 'day-card day-card--today' : 'day-card'}
            >
              <span className="day-card__dow">{formatShortDay(date)}</span>
              <div className="day-card__body">
                <div className="day-card__name">{day.name}</div>
                {meta && <div className="day-card__meta">{meta}</div>}
              </div>
              <StateMark
                state={
                  day.rest
                    ? restDayState(byDayId.get(day.id), buildDeck(day, week, date))
                    : sessionState(byDayId.get(day.id))
                }
              />
            </div>
          )
        })}

        <button type="button" className="build-card" onClick={() => setUpdateOpen(true)}>
          <div className="day-card__body">
            <div className="build-card__title">Update program</div>
            <div className="build-card__body">Edit it yourself, or ask AI using what you've logged</div>
          </div>
          <ChevronRightIcon />
        </button>
      </div>

      {updateOpen && (
        <Sheet
          title="Update program"
          body={`Week ${week} of ${program.programWeeks} · ${finished} of ${training} sessions logged so far`}
          onClose={() => setUpdateOpen(false)}
        >
          <div style={{ marginTop: -8, borderTop: '1.5px solid var(--text)' }}>
            <button type="button" className="ob-row" style={{ minHeight: 72 }} onClick={() => navigate('/program/edit')}>
              <div className="ob-row__main">
                <div className="ob-row__title ob-row__title--on" style={{ fontSize: 18 }}>Edit it myself</div>
                <div className="ob-row__sub">Opens the builder on your current program</div>
              </div>
            </button>
            <button type="button" className="ob-row" style={{ minHeight: 72, opacity: finished ? 1 : 0.5 }} disabled={!finished} onClick={() => navigate('/build')}>
              <div className="ob-row__main">
                <div className="ob-row__title ob-row__title--on" style={{ fontSize: 18 }}>Ask AI</div>
                <div className="ob-row__sub">
                  {finished ? 'Uses what you’ve logged so far, against your goal. You see what’s sent first.' : 'Log a session first'}
                </div>
              </div>
            </button>
          </div>
          <button type="button" className="ob-outline" onClick={() => setUpdateOpen(false)}>
            Cancel
          </button>
        </Sheet>
      )}

      {sheetOpen && (
        <SwapSheet
          program={program}
          onClose={() => setSheetOpen(false)}
          onConfirm={(a, b) => {
            void applySwap(a, b)
            setSheetOpen(false)
          }}
        />
      )}
    </div>
  )
}
