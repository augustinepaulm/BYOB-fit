// Week, frames 3j to 3m in the 1b layout (EXEC-10A task 9): the current week,
// any other week by the arrows (future ones "As planned today"), a read-only
// future day, the swap sheet, and Phase 9's Update program.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ReviewBanner } from '../ai/parts.tsx'
import { BuilderBar, ChevronRight, Hero, Sheet, SwapArrows } from '../builder/ui.tsx'
import { listSessionsBetween } from '../db/index.ts'
import { formatDayOrder, formatShortDay, formatWeekRange, isSameDate, toISODate } from '../lib/dates.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { dayForDate, isActiveOn, resolveItem, weekDates } from '../lib/program.ts'
import { buildDeck, restDayState, sessionState, type DayState } from '../lib/session.ts'
import { SECTION_ORDER } from '../lib/builder.ts'
import { SectionHead } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import type { Day, Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { CheckIcon, ChevronLeftIcon } from '../ui/icons.tsx'

const DAY_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

function StateMark({ state }: { state: DayState }) {
  if (state === 'done') {
    return (
      <span className="wk-state wk-state--done">
        <CheckIcon size={14} />
        Done
      </span>
    )
  }
  if (state === 'partial') {
    return (
      <span className="wk-state wk-state--partial">
        <span className="wk-dot" />
        Partial
      </span>
    )
  }
  return null
}

function PlannedTag() {
  return <span className="ob-badge">As planned today</span>
}

/** Days that may trade places with `day`, per swappableWith in both directions. */
function partnersOf(program: Program, day: Day): Day[] {
  return program.days.filter((other) => other.id !== day.id && (other.id === day.swappableWith || other.swappableWith === day.id))
}

/** Frame 3m. */
function SwapSheet({ program, onClose, onConfirm }: { program: Program; onClose: () => void; onConfirm: (a: string, b: string) => void }) {
  const [first, setFirst] = useState<Day | null>(null)
  const [second, setSecond] = useState<Day | null>(null)
  const swappable = program.days.filter((d) => partnersOf(program, d).length > 0)
  const eligible = first ? partnersOf(program, first) : swappable
  const days = [...program.days].sort((a, b) => a.order - b.order)

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
    <Sheet title="Swap two days" body="Pick two days this week. Logs stay with the session." onClose={onClose}>
      <div className="wk-dayseg" style={{ marginTop: -6 }}>
        {days.map((day) => {
          const on = day.id === first?.id || day.id === second?.id
          const allowed = on || eligible.some((d) => d.id === day.id)
          return (
            <button type="button" key={day.id} className={on ? 'wk-dayseg--on' : undefined} disabled={!allowed} aria-pressed={on} onClick={() => pick(day)}>
              {formatDayOrder(day.order)}
            </button>
          )
        })}
      </div>
      <div className="wk-pair">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>{first ? formatDayOrder(first.order) : 'Pick one'}</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{first ? (first.focus ?? first.name) : ''}</div>
        </div>
        <SwapArrows />
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--secondary)' }}>{second ? formatDayOrder(second.order) : 'Pick one'}</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{second ? (second.focus ?? second.name) : ''}</div>
        </div>
      </div>
      <button type="button" className="ob-primary" disabled={!first || !second} onClick={() => first && second && onConfirm(first.id, second.id)}>
        <span>{first && second ? `Swap ${formatDayOrder(first.order)} and ${formatDayOrder(second.order)}` : 'Swap'}</span>
      </button>
    </Sheet>
  )
}

/** Frame 3l: a future day as planned today; changes go through the builder. */
function PlannedDay({ program, day, date, week, onBack }: { program: Program; day: Day; date: Date; week: number; onBack: () => void }) {
  const navigate = useNavigate()
  const sections = [...day.sections].sort((a, b) => SECTION_ORDER.indexOf(a.kind) - SECTION_ORDER.indexOf(b.kind))
  return (
    <div className="tl" style={{ paddingBottom: 110 }}>
      <BuilderBar title={`Week ${week}`} onBack={onBack} />
      <Hero title={day.rest ? 'Rest day' : (day.focus ?? day.name)} sub={[DAY_DATE.format(date), day.durationMin ? `about ${day.durationMin} min` : null].filter(Boolean).join(' · ')} />
      <div style={{ margin: '12px 24px 0' }}>
        <PlannedTag />
      </div>
      <div style={{ margin: '0 24px' }}>
        {sections.map((section) => {
          const items = section.items.filter((item) => isActiveOn(item, date))
          if (items.length === 0) return null
          const main = section.kind === 'main' || section.kind === 'block' || section.kind === 'abs'
          return (
            <div key={section.id}>
              <SectionHead aside={String(items.length)}>{section.title}</SectionHead>
              {items.map((item) => {
                const resolved = resolveItem(item, week)
                return (
                  <div className={main ? 'bd-simple bd-simple--main' : 'bd-simple'} key={item.id}>
                    <span className="bd-simple__name">{program.exercises[resolved.exerciseId ?? '']?.name ?? resolved.exerciseId}</span>
                    <span className="bd-value">{prescriptionText(resolved)}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="ob-dock">
        <button type="button" className="ob-outline" onClick={() => navigate('/program/edit')}>
          Edit in builder
        </button>
      </div>
    </div>
  )
}

export function WeekScreen() {
  const { program, today, week, weekPlan, applySwap } = useProgram()
  const navigate = useNavigate()
  const [shown, setShown] = useState<number | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [openDay, setOpenDay] = useState<{ dayId: string; date: Date } | null>(null)

  const viewWeek = shown ?? week
  const dates = useMemo(() => (program ? weekDates(program, viewWeek) : []), [program, viewWeek])

  useEffect(() => {
    if (dates.length === 0) return
    let live = true
    void listSessionsBetween(toISODate(dates[0]), toISODate(dates[dates.length - 1])).then((found) => {
      if (live) setSessions(found)
    })
    return () => {
      live = false
    }
  }, [dates])

  if (!program) return null

  if (openDay) {
    const day = program.days.find((d) => d.id === openDay.dayId)
    if (day) return <PlannedDay program={program} day={day} date={openDay.date} week={viewWeek} onBack={() => setOpenDay(null)} />
  }

  const isCurrent = viewWeek === week
  const isFuture = viewWeek > week
  const byDayId = new Map(sessions.map((s) => [s.dayId, s]))
  // D-027: Ask AI needs at least one finished session this week.
  const finished = isCurrent ? sessions.filter((session) => session.endedAt).length : 0
  const training = program.days.filter((d) => !d.rest).length
  const doneCount = sessions.filter((s) => s.endedAt).length

  return (
    <div className="tl" style={{ paddingBottom: 24 }}>
      <div className="wk-head">
        <button type="button" className="wk-head__arrow" aria-label="Previous week" disabled={viewWeek <= 1} onClick={() => setShown(viewWeek - 1)}>
          <ChevronLeftIcon />
        </button>
        <div className="wk-head__mid">
          <div className="wk-head__range">{formatWeekRange(dates)}</div>
          <h1 className="wk-head__title">
            Week {viewWeek} of {program.programWeeks}
          </h1>
        </div>
        <button
          type="button"
          className="wk-head__arrow"
          aria-label="Next week"
          disabled={viewWeek >= program.programWeeks}
          onClick={() => setShown(viewWeek + 1)}
        >
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
            <ChevronLeftIcon />
          </span>
        </button>
      </div>

      {isFuture ? (
        <>
          <div className="wk-planned">
            <PlannedTag />
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--secondary)', margin: '8px 40px 0' }}>
            Updates to your program can change this week.
          </div>
        </>
      ) : (
        isCurrent && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            <button type="button" className="ai-btn" onClick={() => setSheetOpen(true)}>
              <SwapArrows />
              Swap days
            </button>
          </div>
        )
      )}

      {isCurrent && (
        <div style={{ marginTop: 14 }}>
          <ReviewBanner program={program} />
        </div>
      )}

      <div style={{ margin: isFuture ? '14px 24px 0' : '0 24px' }}>
        {!isFuture && (
          <SectionHead aside={`${doneCount} of ${training} done`}>{isCurrent ? 'This week' : `Week ${viewWeek}`}</SectionHead>
        )}
        <div style={{ borderTop: isFuture ? '1.5px solid var(--text)' : undefined }}>
          {dates.map((date) => {
            const day = dayForDate(program, isCurrent ? weekPlan : null, date)
            const isToday = isSameDate(date, today)
            const upcoming = toISODate(date) > toISODate(today)
            const title = day.focus ?? day.name
            const sub = [day.rest && title !== 'Rest' ? 'Rest' : null, day.durationMin ? `${day.durationMin} min` : null, isToday ? 'today' : null].filter(Boolean).join(' · ')
            const state = day.rest ? restDayState(byDayId.get(day.id), buildDeck(day, viewWeek, date)) : sessionState(byDayId.get(day.id))
            const content = (
              <>
                <span className={isToday ? 'wk-row__dow wk-row__dow--today' : 'wk-row__dow'}>{formatShortDay(date)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wk-row__name">{title}</div>
                  {sub && <div className="wk-row__sub">{sub}</div>}
                </div>
                {!isFuture && <StateMark state={state} />}
                {upcoming && <ChevronRight />}
              </>
            )
            return upcoming ? (
              <button type="button" className="wk-row" key={toISODate(date)} onClick={() => setOpenDay({ dayId: day.id, date })}>
                {content}
              </button>
            ) : (
              <div className="wk-row" key={toISODate(date)}>
                {content}
              </div>
            )
          })}
        </div>
        {isCurrent && (
          <button type="button" className="wk-row" style={{ borderBottom: 'none' }} onClick={() => setUpdateOpen(true)}>
            <div style={{ flex: 1 }}>
              <div className="wk-row__name" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Update program
              </div>
              <div className="wk-row__sub">Edit it yourself or ask AI</div>
            </div>
            <ChevronRight />
          </button>
        )}
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
                <div className="ob-row__title ob-row__title--on" style={{ fontSize: 18 }}>
                  Edit it myself
                </div>
                <div className="ob-row__sub">Opens the builder on your current program</div>
              </div>
            </button>
            <button type="button" className="ob-row" style={{ minHeight: 72, opacity: finished ? 1 : 0.5 }} disabled={!finished} onClick={() => navigate('/build')}>
              <div className="ob-row__main">
                <div className="ob-row__title ob-row__title--on" style={{ fontSize: 18 }}>
                  Ask AI
                </div>
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
