// Week, frames 3j to 3l in the 1b layout (EXEC-10A task 9): the current week,
// any other week by the arrows (future ones "As planned today"), a future day
// with "Do this today", Change and Restore on every date from today on
// (D-069), and Phase 9's Update program.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ReviewBanner } from '../ai/parts.tsx'
import { Sheet } from '../builder/ui.tsx'
import { endOpenSession, listSessionsBetween } from '../db/index.ts'
import { formatShortDay, formatTrainContext, formatWeekRange, isSameDate, toISODate } from '../lib/dates.ts'
import { canChangeDate, changedFrom, dayLabel } from '../lib/dayChanges.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { dayForDate, isActiveOn, resolveItem, weekDates } from '../lib/program.ts'
import { buildDeck, isSetConfirmed, restDayState, sessionIdFor, sessionState, type DayState } from '../lib/session.ts'
import { SECTION_ORDER } from '../lib/builder.ts'
import { useProgram } from '../program/useProgram.ts'
import { clearDeckState } from '../session/deckState.ts'
import type { Day, Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { StateBlock } from '../ui/StateBlock.tsx'
import { AppHeader, BackChevron, ListRow, Marker, RowChevron, Tick, TrainSwitch } from '../ui/shell.tsx'
import { trainingCounts } from '../lib/scores.ts'
import { ChangeDay } from './ChangeDay.tsx'

const LONG_DAY = new Intl.DateTimeFormat('en-US', { weekday: 'long' })

function PlannedDay({
  day,
  date,
  week,
  program,
  onBack,
  onDoToday,
  onChange,
}: {
  program: Program
  day: Day
  date: Date
  week: number
  onBack: () => void
  onDoToday: (() => void) | null
  /** D-069: Change this date, when it can be changed. */
  onChange: (() => void) | null
}) {
  const sections = [...day.sections].sort((a, b) => SECTION_ORDER.indexOf(a.kind) - SECTION_ORDER.indexOf(b.kind))
  const items = sections.flatMap((section) => section.items.filter((item) => isActiveOn(item, date)).map((item) => ({ section, resolved: resolveItem(item, week) })))
  const logged = items.filter(({ section, resolved }) => section.kind !== 'warmup' && section.kind !== 'cooldown' && resolved.type !== 'check')
  const sets = logged.reduce((n, { resolved }) => n + (resolved.sets ?? 1), 0)
  return (
    <div className="screen">
      <AppHeader context={formatTrainContext(date, week)} back={{ label: `Week ${week}`, onClick: onBack }} />
      <section className="card-v3 today-card">
        <div className="today-card__meta">
          {LONG_DAY.format(date)} · week {week}
        </div>
        <h1 className="today-card__title">{day.rest ? 'Rest day' : (day.focus ?? day.name)}</h1>
        {!day.rest && (
          <p className="today-card__sub">
            {logged.length} {logged.length === 1 ? 'exercise' : 'exercises'} · {sets} {sets === 1 ? 'set' : 'sets'}
            {day.durationMin ? ` · about ${day.durationMin} min` : ''}
          </p>
        )}
        {onDoToday && (
          <button type="button" className="btn btn--primary" onClick={onDoToday}>
            Do this today
          </button>
        )}
        {onChange && (
          <button type="button" className="btn btn--secondary today-card__second" onClick={onChange}>
            Change
          </button>
        )}
      </section>
      {sections.map((section) => {
        const list = section.items.filter((item) => isActiveOn(item, date))
        if (list.length === 0) return null
        return (
          <section className="plan-list" key={section.id}>
            <h2 className="lgroup__title plan-list__head">{section.title}</h2>
            {list.map((item) => {
              const resolved = resolveItem(item, week)
              return (
                <div className="plan-row" key={item.id}>
                  <Marker state="todo" />
                  <span className="plan-row__text">
                    <span className="plan-row__name">{program.exercises[resolved.exerciseId ?? '']?.name ?? resolved.exerciseId}</span>
                    {resolved.cue && <span className="plan-row__sub">{resolved.cue}</span>}
                  </span>
                  <span className="plan-row__value">{prescriptionText(resolved)}</span>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

/** A day's state in Week (2.13 to 2.15). */
function statePill(state: DayState, rest: boolean, past: boolean, isToday: boolean, isFuture: boolean) {
  if (rest) return null
  if (state === 'done') {
    return (
      <span className="wk-pill wk-pill--done">
        <Tick size={11} />
        Done
      </span>
    )
  }
  if (isToday) return <span className="wk-pill wk-pill--today">Today</span>
  if (state === 'partial') return <span className="wk-pill wk-pill--partial">Partly done</span>
  if (past) return <span className="wk-pill wk-pill--missed">Missed</span>
  if (!isFuture) return <span className="wk-pill wk-pill--upcoming">Upcoming</span>
  return null
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
  // The program week a date falls in, for the Change sheet's sub line.
  const weeksOf = (date: Date) => {
    for (let w = 1; w <= program.programWeeks; w++) if (weekDates(program, w).some((d) => isSameDate(d, date))) return w
    return viewWeek
  }
  const changeSheet = changing && (
    <ChangeDay
      program={program}
      date={changing.date}
      current={dayForDate(program, changes, changing.date)}
      isToday={toISODate(changing.date) === todayIso}
      loggedToday={loggedToday}
      preset={changing.preset}
      week={program ? weeksOf(changing.date) : undefined}
      onRestore={changedFrom(program, changes, changing.date, dayForDate(program, changes, changing.date)) ? () => void applyChange(changing.date, null) : undefined}
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
          <PlannedDay
            program={program}
            day={day}
            date={openDay.date}
            week={viewWeek}
            onBack={() => setOpenDay(null)}
            onDoToday={canChangeDate(todayIso, todayIso, todaySessions, dayForDate(program, changes, today).id) ? () => setChanging({ date: today, preset: day }) : null}
            onChange={canChangeDate(toISODate(openDay.date), todayIso, sessions, dayForDate(program, changes, openDay.date).id) ? () => setChanging({ date: openDay.date }) : null}
          />
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

  const counts = trainingCounts({ program, changes, sessions, week: viewWeek, today })
  const trainingDays = dates.filter((d) => !dayForDate(program, changes, d).rest).length
  const summaryLine = isFuture
    ? 'Starts Sunday'
    : isCurrent
      ? `${counts.finished} of ${trainingDays} workouts done so far`
      : `${counts.finished} of ${counts.planned} workouts · ${counts.confirmed} of ${counts.prescribed} sets`

  return (
    <div className="screen">
      <AppHeader context={formatTrainContext(today, week)}>
        <TrainSwitch view="week" />
      </AppHeader>
      <div className="wk-nav">
        <button type="button" className="wk-nav__step" aria-label="Previous week" disabled={viewWeek <= 1} onClick={() => setShown(viewWeek - 1)}>
          {viewWeek > 1 && (
            <>
              <BackChevron />
              Week {viewWeek - 1}
            </>
          )}
        </button>
        <h1 className="wk-nav__title">
          Week {viewWeek} of {program.programWeeks}
        </h1>
        <button
          type="button"
          className="wk-nav__step wk-nav__step--next"
          aria-label="Next week"
          disabled={viewWeek >= program.programWeeks}
          onClick={() => setShown(viewWeek + 1)}
        >
          {viewWeek < program.programWeeks && (
            <>
              Week {viewWeek + 1}
              <RowChevron />
            </>
          )}
        </button>
      </div>
      <p className="wk-summary">
        {summaryLine}
        <span className="visually-hidden"> · {formatWeekRange(dates)}</span>
      </p>
      {isFuture && <p className="note-v3 wk-planned">Updates to your program can change this week.</p>}
      {isCurrent && <ReviewBanner program={program} />}

      <div className="wk-list">
        {dates.map((date) => {
          const day = dayForDate(program, changes, date)
          const isToday = isSameDate(date, today)
          const iso = toISODate(date)
          const upcoming = iso > todayIso
          const past = iso < todayIso
          const title = dayLabel(day)
          const session = sessionOn(date, day.id)
          const state = day.rest ? restDayState(session, buildDeck(day, viewWeek, date)) : sessionState(session)
          const was = changedFrom(program, changes, date, day)
          const changeable = canChangeDate(toISODate(date), todayIso, sessions, day.id)
          const plain = day.rest && !was && !isToday
          const content = (
            <>
              <span className="wk-day__dow">{formatShortDay(date)}</span>
              <span className="wk-day__text">
                <span className={day.rest ? 'wk-day__name wk-day__name--rest' : 'wk-day__name'}>{title}</span>
                {was && <span className="wk-day__sub">Changed (was {dayLabel(was)})</span>}
              </span>
              {statePill(state, Boolean(day.rest), past, isToday, isFuture)}
            </>
          )
          return (
            <div className={`wk-day${plain ? ' wk-day--plain' : ''}${isToday ? ' wk-day--today' : ''}`} key={iso}>
              {upcoming ? (
                <button type="button" className="wk-day__open" aria-label={`Open ${formatShortDay(date)} ${title}`} onClick={() => setOpenDay({ dayId: day.id, date })}>
                  {content}
                </button>
              ) : (
                <div className="wk-day__open">{content}</div>
              )}
              {changeable && (
                <div className="wk-day__actions">
                  <button type="button" className="wk-day__action" aria-label={`Change ${formatShortDay(date)}`} onClick={() => setChanging({ date })}>
                    Change
                  </button>
                  {was && (
                    <button type="button" className="wk-day__action" aria-label={`Restore ${formatShortDay(date)}`} onClick={() => void applyChange(date, null)}>
                      Restore
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {isCurrent && <p className="note-v3">Tap a day to see it. Change and Restore show on today and later days.</p>}
      {!isCurrent && !isFuture && (
        <div className="actions-v3">
          <button type="button" className="btn btn--tertiary" onClick={() => navigate('/progress/training')}>
            See week {viewWeek} in Progress
          </button>
        </div>
      )}
      {isCurrent && (
        <section className="lgroup">
          <div className="lgroup__card">
            <ListRow title="Update program" sub="Edit it yourself or ask AI" onClick={() => setUpdateOpen(true)} />
          </div>
        </section>
      )}

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
