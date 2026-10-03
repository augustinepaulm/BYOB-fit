// Today in the v3 design (frames 2.01 before start, 2.02 in progress, 2.03
// done; D-083): the day's card with its one action, then the day's items.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ReviewBanner } from '../ai/parts.tsx'
import { endOpenSession, listAllSessions } from '../db/index.ts'
import { formatShortDay, formatTrainContext, toISODate } from '../lib/dates.ts'
import { canChangeDate } from '../lib/dayChanges.ts'
import { shouldShowBackupNote } from '../lib/notices.ts'
import { formatClock, prescriptionText } from '../lib/prescription.ts'
import { dayForDate, isActiveOn, isLogged, resolveItem } from '../lib/program.ts'
import {
  buildDeck,
  findEntry,
  findReferenceEntry,
  isSetConfirmed,
  restDayState,
  sessionIdFor,
  setRowsFor,
  summarise,
  type DeckItem,
} from '../lib/session.ts'
import { compareWithLastWeek, readyToProgress } from '../lib/summary.ts'
import { applyOrder, isDeckItemDone } from '../lib/todayPlan.ts'
import { useProgram } from '../program/useProgram.ts'
import { clearDeckState, onDeckStateChange, readDeckState, type DeckState } from '../session/deckState.ts'
import { useSession } from '../session/useSession.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Program, Section } from '../types/program.ts'
import type { Entry, Session } from '../types/stores.ts'
import { StateBlock } from '../ui/StateBlock.tsx'
import { AppHeader, EmptyState, Marker, Tick, TrainSwitch, type RowState } from '../ui/shell.tsx'
import { ChangeDay } from './ChangeDay.tsx'

/** Frame 7a "Loading": shown while the program is read from the phone. */
export function TodayLoading() {
  return (
    <div className="tl">
      <div className="tl-state">
        <StateBlock role="status" mark="loading" title="Loading today" body="This only takes a moment." />
      </div>
    </div>
  )
}

/** Frame 7a "Monthly backup reminder" (D-050 rule 2): one note, dismissible. */
function BackupNote() {
  const navigate = useNavigate()
  const { settings, loading, update } = useSettings()
  if (loading || !shouldShowBackupNote(settings, new Date())) return null
  return (
    <section className="card-v3 backup-note">
      <div className="card-v3__title">Back up your data</div>
      <p className="lrow__sub">{settings.lastExportAt ? 'It’s been a month since your last export.' : 'You haven’t exported your data yet.'}</p>
      <div className="card-v3__buttons">
        <button type="button" className="chip" onClick={() => navigate('/settings', { state: { export: true } })}>
          Export now
        </button>
        <button type="button" className="btn btn--tertiary" onClick={() => void update({ backupNoteDismissedAt: new Date().toISOString() })}>
          Not now
        </button>
      </div>
    </section>
  )
}

/** "Last week 70 kg × 8, 8, 7, 7" for a load item with a comparable reference (2.01). */
function lastWeekText(entry: Entry | undefined, unit: string): string | null {
  const sets = (entry?.sets ?? []).filter(isSetConfirmed)
  if (sets.length === 0 || sets[0].weight === undefined) return null
  const weights = new Set(sets.map((s) => s.weight))
  if (weights.size === 1) return `Last week ${sets[0].weight} ${unit} × ${sets.map((s) => s.reps ?? '–').join(', ')}`
  return `Last week ${sets.map((s) => `${s.weight} × ${s.reps ?? '–'}`).join(', ')}`
}

function SectionList({
  section,
  program,
  week,
  date,
  session,
  history,
  dayId,
  nowId,
  onToggle,
}: {
  section: Section
  program: Program
  week: number
  /** Items retired on or before this date are not listed (D-028). */
  date: Date
  session?: Session
  history: Session[]
  dayId: string
  nowId?: string
  /** Present only where the screen owns the check-off (rest days). */
  onToggle?: (itemId: string, exerciseId: string, next: boolean) => void
}) {
  const items = section.items.filter((item) => isActiveOn(item, date))
  if (items.length === 0) return null
  return (
    <section className="plan-list">
      <h2 className="lgroup__title plan-list__head">{section.title}</h2>
      {items.map((item) => {
        const resolved = resolveItem(item, week)
        const entry = findEntry(session, item.id)
        const exerciseId = entry?.exerciseId ?? resolved.exerciseId ?? ''
        const name = program.exercises[exerciseId]?.name ?? exerciseId
        const logged = isLogged(section.kind, resolved)
        // Done as Resume and the plan sheet read it (isDeckItemDone): a logged set, a skip, or a check.
        const done = entry?.skipped === true || (logged ? (entry?.sets ?? []).some(isSetConfirmed) : entry?.checked === true)
        const state: RowState = item.id === nowId ? 'now' : done ? 'done' : 'todo'
        const checkable = onToggle && !logged
        const last = !session?.startedAt && (section.kind === 'main' || section.kind === 'block') && (resolved.type ?? 'load_reps') === 'load_reps' ? lastWeekText(findReferenceEntry(history, dayId, exerciseId, 'load_reps'), resolved.unit ?? 'kg') : null
        const body = (
          <>
            <Marker state={state} />
            <span className="plan-row__text">
              <span className={state === 'done' ? 'plan-row__name plan-row__name--done' : state === 'now' ? 'plan-row__name plan-row__name--now' : 'plan-row__name'}>
                {name}
                {resolved.index && <span className="tl-tag">index</span>}
              </span>
              {last && <span className="plan-row__sub">{last}</span>}
              {resolved.cue && <span className="plan-row__sub">{resolved.cue}</span>}
            </span>
            <span className="plan-row__value">{state === 'now' ? 'Now' : prescriptionText(resolved)}</span>
          </>
        )
        const className = state === 'now' ? 'plan-row plan-row--now' : 'plan-row'
        if (checkable) {
          return (
            <button type="button" key={item.id} className={className} aria-pressed={entry?.checked === true} onClick={() => onToggle(item.id, exerciseId, entry?.checked !== true)}>
              {body}
            </button>
          )
        }
        return (
          <div key={item.id} className={className}>
            {body}
          </div>
        )
      })}
    </section>
  )
}

function TrainHeader({ today, week }: { today: Date; week?: number }) {
  return (
    <AppHeader context={week ? formatTrainContext(today, week) : formatShortDay(today)}>
      <TrainSwitch view="today" />
    </AppHeader>
  )
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'long' })

/** "Friday is a rest day. Lower B on Saturday." (2.03) */
function comingUp(program: Program, changes: Parameters<typeof dayForDate>[1], today: Date): string {
  const next = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n)
  const tomorrow = dayForDate(program, changes, next(1))
  if (!tomorrow.rest) return `${tomorrow.focus ?? tomorrow.name} tomorrow.`
  for (let n = 2; n <= 7; n++) {
    const day = dayForDate(program, changes, next(n))
    if (!day.rest) return `${WEEKDAY.format(next(1))} is a rest day. ${day.focus ?? day.name} on ${WEEKDAY.format(next(n))}.`
  }
  return `${WEEKDAY.format(next(1))} is a rest day.`
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export function TodayScreen() {
  const { program, today, week, changes, setChange } = useProgram()
  const navigate = useNavigate()
  const [history, setHistory] = useState<Session[]>([])
  const [kept, setKept] = useState<DeckState | null>(null)
  const [now, setNow] = useState(Date.now)
  const [changing, setChanging] = useState(false)

  const day = program ? dayForDate(program, changes, today) : null
  const scheduled = program?.days.find((d) => d.order === today.getDay())
  const swapped = Boolean(scheduled && day && scheduled.id !== day.id)
  const todayIso = toISODate(today)

  const target = useMemo(() => (day ? { date: todayIso, dayId: day.id, programWeek: week, swapped } : null), [day, todayIso, week, swapped])
  const api = useSession(target)

  // Resume follows today's order once the user has moved something (D-063, D-065 rule 1).
  const order = api.session?.order
  const deck = useMemo(() => (day && program ? applyOrder(buildDeck(day, week, today), day, order) : []), [day, program, week, today, order])

  useEffect(() => {
    let live = true
    void listAllSessions().then((found) => live && setHistory(found))
    return () => {
      live = false
    }
  }, [api.session])

  // D-077 rule 4: the rest the deck left running shows here too (2.02).
  const sessionId = day ? sessionIdFor(todayIso, day.id) : null
  useEffect(() => {
    if (!sessionId) return
    let live = true
    const load = () => void readDeckState(sessionId).then((found) => live && setKept(found))
    load()
    const off = onDeckStateChange(load)
    return () => {
      live = false
      off()
    }
  }, [sessionId])
  const resting = kept?.restUntil && kept.restUntil > now ? kept.restUntil : null
  useEffect(() => {
    if (!resting) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [resting])

  if (!program) {
    // 4.01 "No program yet": onboarding finished without one, or it was removed.
    return (
      <div className="screen">
        <TrainHeader today={today} />
        <BackupNote />
        <EmptyState title="No program yet" body="Pick a starter program or build your own. It takes a few minutes." action={{ label: 'Pick a starter', onClick: () => navigate('/program/new') }} />
        <div className="actions-v3">
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/program/new', { state: { build: true } })}>
            Build my own
          </button>
        </div>
      </div>
    )
  }
  if (!day) return null
  const session = api.session ?? undefined
  const others = history.filter((s) => s.id !== session?.id)
  // D-074 rule 6, D-075 rule 1: not once today's current workout has ended.
  const canChange = canChangeDate(todayIso, todayIso, [...others, ...(session ? [session] : [])].filter((s) => s.date === todayIso), day.id)
  const changeSheet = changing && (
    <ChangeDay
      program={program}
      date={today}
      current={day}
      isToday
      week={week}
      loggedToday={(session?.entries ?? []).some((e) => e.sets.some(isSetConfirmed))}
      onClose={() => setChanging(false)}
      onConfirm={async (dayId) => {
        // D-069 rule 4, D-086: an open session ends as it stands, or goes if empty.
        if (await endOpenSession(todayIso, day.id)) await clearDeckState(sessionIdFor(todayIso, day.id))
        await setChange(todayIso, dayId)
        setChanging(false)
      }}
    />
  )
  const lists = (nowId?: string, onToggle?: (itemId: string, exerciseId: string, next: boolean) => void) =>
    day.sections.map((section) => (
      <SectionList key={section.id} section={section} program={program} week={week} date={today} session={session} history={others} dayId={day.id} nowId={nowId} onToggle={onToggle} />
    ))

  if (day.rest) {
    const restDone = restDayState(session, deck) === 'done'
    return (
      <div className="screen">
        <TrainHeader today={today} week={week} />
        <BackupNote />
        <ReviewBanner program={program} />
        <section className="card-v3 today-card">
          {restDone ? (
            <div className="today-card__done">
              <span className="today-card__check" aria-hidden="true">
                <Tick size={20} />
              </span>
              <div>
                <h1 className="today-card__title">Done today</h1>
                <p className="today-card__sub">Recovery counts as training.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="today-card__meta">
                Week {week} of {program.programWeeks} · {program.name}
              </div>
              <h1 className="today-card__title">Rest day</h1>
              <p className="today-card__sub">{deck.length ? "Recovery counts as training. Today's daily items:" : 'Nothing scheduled. Recovery counts as training.'}</p>
            </>
          )}
        </section>
        {lists(undefined, (itemId, exerciseId, next) => void api.setChecked(itemId, exerciseId, next))}
        {canChange && (
          <div className="actions-v3">
            <button type="button" className="btn btn--tertiary" onClick={() => setChanging(true)}>
              Change today&apos;s workout
            </button>
          </div>
        )}
        {changeSheet}
      </div>
    )
  }

  // Resume points at the first item with nothing recorded against it.
  const nextUp: DeckItem | undefined = deck.find((deckItem) => {
    const entry = findEntry(session, deckItem.item.id)
    if (deckItem.logged) return !(entry?.sets ?? []).some(isSetConfirmed)
    return entry?.checked !== true
  })
  const started = session !== undefined && session.entries.length > 0
  const finished = Boolean(session?.endedAt)
  const summary = summarise(session, deck)
  const doneCount = deck.filter((d) => isDeckItemDone(d, session)).length
  const totalSets = deck.filter((d) => d.logged && d.resolved.type !== 'check').reduce((n, d) => n + setRowsFor(d.resolved).length, 0)
  const warmup = deck.find((d) => d.section.kind === 'warmup' && d.resolved.minutes)
  const name = day.focus ?? day.name

  async function enterDeck() {
    await api.start()
    navigate('/deck', { state: { fromToday: true } })
  }

  let card
  if (finished) {
    const compared = compareWithLastWeek(session, deck, others, day.id)
    const ready = readyToProgress(session, deck, others, (id) => program?.exercises[id])
    const words = [
      compared.up > 0 ? `${compared.up === 1 ? 'One lift' : `${count(compared.up, 'lift')}`} went up on last week.` : null,
      ready.length > 0 ? `${program.exercises[ready[0].exerciseId]?.name ?? ready[0].exerciseId} is ready to progress.` : null,
    ].filter(Boolean)
    card = (
      <section className="card-v3 today-card">
        <div className="today-card__done">
          <span className="today-card__check" aria-hidden="true">
            <Tick size={20} />
          </span>
          <div>
            <h1 className="today-card__title">{name} done</h1>
            <p className="today-card__sub">
              {doneCount} of {count(deck.length, 'exercise')} · {summary.setsConfirmed} of {count(totalSets, 'set')}
              {summary.durationMin !== null ? ` · ${summary.durationMin} min` : ''}
            </p>
          </div>
        </div>
        {words.length > 0 && <p className="today-card__words">{words.join(' ')}</p>}
        <button type="button" className="btn btn--secondary" onClick={() => navigate('/deck', { state: { summary: true } })}>
          See summary
        </button>
      </section>
    )
  } else if (started && nextUp) {
    const entry = findEntry(session, nextUp.item.id)
    const nextName = program.exercises[entry?.exerciseId ?? nextUp.resolved.exerciseId ?? '']?.name ?? nextUp.resolved.exerciseId
    const setN = (entry?.sets ?? []).filter(isSetConfirmed).length + 1
    const setTotal = setRowsFor(nextUp.resolved).length
    card = (
      <section className="card-v3 today-card">
        <div className="today-card__row">
          <span className="today-card__state">In progress</span>
          {resting && <span className="pill-soft">Rest {formatClock((resting - now) / 1000)}</span>}
        </div>
        <h1 className="today-card__title">{nextUp.logged && nextUp.resolved.type !== 'check' ? `${nextName}, set ${Math.min(setN, setTotal)} of ${setTotal}` : nextName}</h1>
        <p className="today-card__sub">
          {doneCount} of {count(deck.length, 'exercise')} done
        </p>
        <button type="button" className="btn btn--primary" onClick={() => void enterDeck()}>
          Back to workout
        </button>
      </section>
    )
  } else {
    card = (
      <section className="card-v3 today-card">
        <div className="today-card__meta">
          Week {week} of {program.programWeeks} · {program.name}
        </div>
        <h1 className="today-card__title">{name}</h1>
        <p className="today-card__sub">
          {count(deck.filter((d) => d.logged && d.resolved.type !== 'check').length, 'exercise')} · {count(totalSets, 'set')}
          {warmup ? ` after a ${warmup.resolved.minutes} min warm-up` : day.durationMin ? ` · about ${day.durationMin} min` : ''}
        </p>
        <button type="button" className="btn btn--primary" onClick={() => void enterDeck()}>
          Start workout
        </button>
      </section>
    )
  }

  return (
    <div className="screen">
      <TrainHeader today={today} week={week} />
      <BackupNote />
      <ReviewBanner program={program} />
      {swapped && <p className="note-v3 note-v3--top">Changed: this is {day.name}&apos;s session</p>}
      {card}
      {finished && (
        <section className="card-v3 coming-up">
          <div className="usage-card__label">Coming up</div>
          <p className="coming-up__text">{comingUp(program, changes, today)}</p>
        </section>
      )}
      {lists(started && !finished ? nextUp?.item.id : undefined)}
      {canChange && !started && (
        <div className="actions-v3">
          <button type="button" className="btn btn--tertiary" onClick={() => setChanging(true)}>
            Change today&apos;s workout
          </button>
        </div>
      )}
      {changeSheet}
    </div>
  )
}
