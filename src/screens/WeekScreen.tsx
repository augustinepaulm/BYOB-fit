// Week, frames 3j to 3l in the 1b layout (EXEC-10A task 9): the current week,
// any other week by the arrows (future ones "As planned today"), a future day
// with "Do this today", Change and Restore on every date from today on
// (D-069), and Phase 9's Update program.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ReviewBanner } from '../ai/parts.tsx'
import { BuilderBar, ChevronRight, Hero, Sheet } from '../builder/ui.tsx'
import { endOpenSession, listSessionsBetween } from '../db/index.ts'
import { formatShortDay, formatTrainContext, formatWeekRange, isSameDate, toISODate } from '../lib/dates.ts'
import { canChangeDate, changedFrom, dayLabel } from '../lib/dayChanges.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { dayForDate, isActiveOn, resolveItem, weekDates } from '../lib/program.ts'
import { buildDeck, isSetConfirmed, restDayState, sessionIdFor, sessionState, type DayState } from '../lib/session.ts'
import { SECTION_ORDER } from '../lib/builder.ts'
import { SectionHead } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import { clearDeckState } from '../session/deckState.ts'
import type { Day, Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { CheckIcon, ChevronLeftIcon } from '../ui/icons.tsx'
import { StateBlock } from '../ui/StateBlock.tsx'
import { AppHeader, TrainSwitch } from '../ui/shell.tsx'
import { ChangeDay } from './ChangeDay.tsx'

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

/**
 * Frame 3l: a future day. D-059: no badge, each item's cue under its name, and
 * the dock above the tab bar. D-069 rule 3: its only action is "Do this today".
 */
function PlannedDay({ day, date, week, program, onBack, onDoToday }: { program: Program; day: Day; date: Date; week: number; onBack: () => void; onDoToday: (() => void) | null }) {
  const sections = [...day.sections].sort((a, b) => SECTION_ORDER.indexOf(a.kind) - SECTION_ORDER.indexOf(b.kind))
  return (
    // The tabbed layout already pads by the tab bar's height; this clears the
    // dock above it (about 80 px), so the last item scrolls fully into view.
    <div className="tl" style={{ paddingBottom: 96 }}>
      <BuilderBar title={`Week ${week}`} onBack={onBack} />
      <Hero title={day.rest ? 'Rest day' : (day.focus ?? day.name)} sub={[DAY_DATE.format(date), day.durationMin ? `about ${day.durationMin} min` : null].filter(Boolean).join(' · ')} />
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
                    <span className="bd-simple__name">
                      {program.exercises[resolved.exerciseId ?? '']?.name ?? resolved.exerciseId}
                      {resolved.cue && <span className="tl-row__cue">{resolved.cue}</span>}
                    </span>
                    <span className="bd-value">{prescriptionText(resolved)}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {onDoToday && (
        <div className="ob-dock ob-dock--above-tabbar">
          <button type="button" className="ob-primary" style={{ justifyContent: 'center' }} onClick={onDoToday}>
            <span>Do this today</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function WeekScreen() {
  const { program, today, week, changes, setChange, restoreDate } = useProgram()
  const navigate = useNavigate()
  const [shown, setShown] = useState<number | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [todaySessions, setTodaySessions] = useState<Session[]>([])
  const [updateOpen, setUpdateOpen] = useState(false)
  const [openDay, setOpenDay] = useState<{ dayId: string; date: Date } | null>(null)
  // D-069: the date being changed, or today taking a future day's workout.
  const [changing, setChanging] = useState<{ date: Date; preset?: Day } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const todayIso = toISODate(today)

  const viewWeek = shown ?? week
  const dates = useMemo(() => (program ? weekDates(program, viewWeek) : []), [program, viewWeek])

  useEffect(() => {
    if (dates.length === 0) return
    let live = true
    void listSessionsBetween(toISODate(dates[0]), toISODate(dates[dates.length - 1])).then((found) => {
      if (live) setSessions(found)
    })
    void listSessionsBetween(todayIso, todayIso).then((found) => {
      if (live) setTodaySessions(found)
    })
    return () => {
      live = false
    }
  }, [dates, todayIso, reloadKey])

  if (!program) {
    // 7c "Week, no program".
    return (
      <div className="tl" style={{ paddingBottom: 24 }}>
        <AppHeader context={formatShortDay(today)}>
          <TrainSwitch view="week" />
        </AppHeader>
        <div className="bd-hero">
          <h1 className="lg-title">Week</h1>
        </div>
        <div className="tl-state">
          <StateBlock
            mark="+"
            title="No program yet"
            body="Your week appears here once you have a program."
            primary={{ label: 'Pick a starter', onClick: () => navigate('/program/new') }}
          />
        </div>
      </div>
    )
  }

  // D-069 rule 4: today's logged sets stay; its open session ends before the change.
  const loggedToday = todaySessions.some((s) => s.entries.some((e) => e.sets.some(isSetConfirmed)))
  const applyChange = async (date: Date, dayId: string | null) => {
    const iso = toISODate(date)
    if (iso === todayIso) {
      const dayId = dayForDate(program, changes, date).id
      if (await endOpenSession(iso, dayId)) await clearDeckState(sessionIdFor(iso, dayId))
    }
    if (dayId === null) await restoreDate(iso)
    else await setChange(iso, dayId)
    setReloadKey((k) => k + 1)
  }
  const changeSheet = changing && (
    <ChangeDay
      program={program}
      date={changing.date}
      current={dayForDate(program, changes, changing.date)}
      isToday={toISODate(changing.date) === todayIso}
      loggedToday={loggedToday}
      preset={changing.preset}
      onClose={() => setChanging(null)}
      onConfirm={async (dayId) => {
        await applyChange(changing.date, dayId)
        // "Do this today" opens the deck on the new workout.
        if (changing.preset) navigate('/deck')
      }}
    />
  )

  if (openDay) {
    const day = program.days.find((d) => d.id === openDay.dayId)
    if (day)
      return (
        <>
          <PlannedDay program={program} day={day} date={openDay.date} week={viewWeek} onBack={() => setOpenDay(null)} onDoToday={canChangeDate(todayIso, todayIso, todaySessions, dayForDate(program, changes, today).id) ? () => setChanging({ date: today, preset: day }) : null} />
          {changeSheet}
        </>
      )
  }

  const isCurrent = viewWeek === week
  const isFuture = viewWeek > week
  // D-069: one workout can fall on two dates in a week, so sessions are found by date and day.
  const sessionOn = (date: Date, dayId: string) => sessions.find((s) => s.date === toISODate(date) && s.dayId === dayId)
  // D-027: Ask AI needs at least one finished session this week.
  const finished = isCurrent ? sessions.filter((session) => session.endedAt).length : 0
  const training = program.days.filter((d) => !d.rest).length
  const doneCount = sessions.filter((s) => s.endedAt).length

  return (
    <div className="tl" style={{ paddingBottom: 24 }}>
      <AppHeader context={formatTrainContext(today, week)}>
        <TrainSwitch view="week" />
      </AppHeader>
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
      ) : null}

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
            const day = dayForDate(program, changes, date)
            const isToday = isSameDate(date, today)
            const upcoming = toISODate(date) > toISODate(today)
            const title = dayLabel(day)
            const sub = [day.rest && title !== 'Rest' ? 'Rest' : null, day.durationMin ? `${day.durationMin} min` : null, isToday ? 'today' : null].filter(Boolean).join(' · ')
            const session = sessionOn(date, day.id)
            const state = day.rest ? restDayState(session, buildDeck(day, viewWeek, date)) : sessionState(session)
            const was = changedFrom(program, changes, date, day)
            const changeable = canChangeDate(toISODate(date), todayIso, sessions, day.id)
            const content = (
              <>
                <span className={isToday ? 'wk-row__dow wk-row__dow--today' : 'wk-row__dow'}>{formatShortDay(date)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wk-row__name">{title}</div>
                  {sub && <div className="wk-row__sub">{sub}</div>}
                  {was && <div className="wk-row__changed">Changed (was {dayLabel(was)})</div>}
                </div>
                {!isFuture && <StateMark state={state} />}
                {upcoming && <ChevronRight />}
              </>
            )
            return (
              <div className="wk-row wk-row--day" key={toISODate(date)}>
                {upcoming ? (
                  <button type="button" className="wk-row__open" aria-label={`Open ${formatShortDay(date)} ${title}`} onClick={() => setOpenDay({ dayId: day.id, date })}>
                    {content}
                  </button>
                ) : (
                  <div className="wk-row__open">{content}</div>
                )}
                {changeable && (
                  <div className="wk-row__actions">
                    <button type="button" className="wk-row__action" aria-label={`Change ${formatShortDay(date)}`} onClick={() => setChanging({ date })}>
                      Change
                    </button>
                    {was && (
                      <button type="button" className="wk-row__action" aria-label={`Restore ${formatShortDay(date)}`} onClick={() => void applyChange(date, null)}>
                        Restore
                      </button>
                    )}
                  </div>
                )}
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

      {changeSheet}
    </div>
  )
}
