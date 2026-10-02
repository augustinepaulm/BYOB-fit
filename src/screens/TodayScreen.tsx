// Today, frame 3a in the 1b layout (EXEC-10A task 5).

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ReviewBanner } from '../ai/parts.tsx'
import { formatLongDate, toISODate } from '../lib/dates.ts'
import { shouldShowBackupNote } from '../lib/notices.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { dayForDate, isActiveOn, isLogged, resolveItem } from '../lib/program.ts'
import { buildDeck, findEntry, isSetConfirmed, restDayState, summarise } from '../lib/session.ts'
import { applyOrder } from '../lib/todayPlan.ts'
import { PrimaryButton, SectionHead } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import { useSession } from '../session/useSession.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Program, Section } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { CheckIcon, SwapIcon } from '../ui/icons.tsx'
import { StateBlock } from '../ui/StateBlock.tsx'

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
    <div className="tl-state tl-state--note">
      <StateBlock
        mark="↓"
        title="Back up your data"
        body={settings.lastExportAt ? 'It’s been a month since your last export.' : 'You haven’t exported your data yet.'}
        primary={{ label: 'Export now', onClick: () => navigate('/settings', { state: { export: true } }) }}
        secondary={{ label: 'Not now', onClick: () => void update({ backupNoteDismissedAt: new Date().toISOString() }) }}
      />
    </div>
  )
}

function SectionList({
  section,
  program,
  week,
  date,
  session,
  onToggle,
}: {
  section: Section
  program: Program
  week: number
  /** Items retired on or before this date are not listed (D-028). */
  date: Date
  session?: Session
  /** Present only where the screen owns the check-off (rest days). */
  onToggle?: (itemId: string, exerciseId: string, next: boolean) => void
}) {
  const items = section.items.filter((item) => isActiveOn(item, date))
  if (items.length === 0) return null
  const main = section.kind === 'main' || section.kind === 'block'
  return (
    <div className="tl-section">
      <SectionHead aside={String(items.length)}>{section.title}</SectionHead>
      {items.map((item) => {
        const resolved = resolveItem(item, week)
        const exerciseId = resolved.exerciseId ?? ''
        const name = program.exercises[exerciseId]?.name ?? exerciseId
        const entry = findEntry(session, item.id)
        const checkable = onToggle && !isLogged(section.kind, resolved)
        const body = (
          <>
            <span className="tl-row__name">
              {name}
              {resolved.index && <span className="tl-tag">index</span>}
              {checkable && entry?.checked && (
                <span className="tl-row__mark">
                  <CheckIcon size={16} />
                </span>
              )}
              {resolved.cue && <span className="tl-row__cue">{resolved.cue}</span>}
            </span>
            <span className="tl-row__value">{prescriptionText(resolved)}</span>
          </>
        )
        if (checkable) {
          return (
            <button
              type="button"
              key={item.id}
              className={main ? 'tl-row tl-row--main' : 'tl-row'}
              aria-pressed={entry?.checked === true}
              onClick={() => onToggle(item.id, exerciseId, entry?.checked !== true)}
            >
              {body}
            </button>
          )
        }
        return (
          <div key={item.id} className={main ? 'tl-row tl-row--main' : 'tl-row'}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

export function TodayScreen() {
  const { program, today, week, changes } = useProgram()
  const navigate = useNavigate()

  const day = program ? dayForDate(program, changes, today) : null
  const scheduled = program?.days.find((d) => d.order === today.getDay())
  const swapped = Boolean(scheduled && day && scheduled.id !== day.id)

  const target = useMemo(
    () => (day ? { date: toISODate(today), dayId: day.id, programWeek: week, swapped } : null),
    [day, today, week, swapped],
  )
  const api = useSession(target)

  // Resume follows today's order once the user has moved something (D-063, D-065 rule 1).
  const order = api.session?.order
  const deck = useMemo(() => (day && program ? applyOrder(buildDeck(day, week, today), day, order) : []), [day, program, week, today, order])

  if (!program) {
    // 7a "No program yet": onboarding finished without one, or it was removed.
    return (
      <div className="tl">
        <div className="tl-head">
          <div className="tl-head__meta">
            <span>{formatLongDate(today)}</span>
          </div>
          <h1 className="tl-head__title">Today</h1>
        </div>
        <BackupNote />
        <div className="tl-state">
          <StateBlock
            mark="+"
            title="No program yet"
            body="Pick a starter program or build your own. It takes a few minutes."
            primary={{ label: 'Pick a starter', onClick: () => navigate('/program/new') }}
            secondary={{ label: 'Build my own', onClick: () => navigate('/program/new', { state: { build: true } }) }}
          />
        </div>
      </div>
    )
  }
  if (!day) return null

  const session = api.session ?? undefined
  const finished = Boolean(session?.endedAt)
  const head = (title: string, sub: string) => (
    <div className="tl-head">
      <div className="tl-head__meta">
        <span>{formatLongDate(today)}</span>
        <span>
          Week {week} of {program.programWeeks}
        </span>
      </div>
      <h1 className="tl-head__title">{title}</h1>
      {sub && <div className="tl-head__sub">{sub}</div>}
    </div>
  )

  if (day.rest) {
    const restDone = restDayState(session, deck) === 'done'
    return (
      <div className="tl">
        {/* With nothing scheduled, the 7a state block carries the words. */}
        {deck.length ? head('Rest day', "Recovery counts as training. Today's daily items:") : head('Today', '')}
        <BackupNote />
        <ReviewBanner program={program} />
        {deck.length === 0 && (
          <div className="tl-state">
            <StateBlock mark="–" title="Rest day" body="Nothing scheduled. Recovery counts as training." />
          </div>
        )}
        {day.sections.map((section) => (
          <SectionList
            key={section.id}
            section={section}
            program={program}
            week={week}
            date={today}
            session={session}
            onToggle={(itemId, exerciseId, next) => void api.setChecked(itemId, exerciseId, next)}
          />
        ))}
        {restDone && (
          <div className="tl-dock">
            <div className="tl-done">
              <CheckIcon size={20} />
              Done today
            </div>
          </div>
        )}
      </div>
    )
  }

  // Resume points at the first item with nothing recorded against it.
  const nextUp = deck.find((deckItem) => {
    const entry = findEntry(session, deckItem.item.id)
    if (deckItem.logged) return !(entry?.sets ?? []).some(isSetConfirmed)
    return entry?.checked !== true
  })
  const started = session !== undefined && session.entries.length > 0
  const summary = summarise(session, deck)
  const sub = [day.durationMin ? `About ${day.durationMin} min` : null, `${deck.length} ${deck.length === 1 ? 'item' : 'items'}`]
    .filter(Boolean)
    .join(' · ')

  async function enterDeck() {
    await api.start()
    navigate('/deck', { state: { fromToday: true } })
  }

  return (
    <div className="tl" style={{ paddingBottom: 8 }}>
      {head(day.focus ?? day.name, sub)}
      <BackupNote />
      <ReviewBanner program={program} />
      {swapped && (
        <div className="banner">
          <SwapIcon />
          <span>Swapped: this is {day.name}&apos;s session</span>
        </div>
      )}
      {day.sections.map((section) => (
        <SectionList key={section.id} section={section} program={program} week={week} date={today} session={session} />
      ))}
      {finished && (
        <div className="tl-line">
          <span>
            {summary.setsConfirmed} sets
            {summary.volumeByUnit.map(({ unit, volume }) => ` · ${volume.toLocaleString('en-US')} ${unit}`)}
            {summary.durationMin !== null ? ` · ${summary.durationMin} min` : ''}
          </span>
          <Link to="/log">View log</Link>
        </div>
      )}
      <div className="tl-dock">
        {finished ? (
          <div className="tl-done">
            <CheckIcon size={20} />
            Done today
          </div>
        ) : (
          <PrimaryButton onClick={() => void enterDeck()}>
            {started && nextUp ? `Resume · ${nextUp.section.title}, ${nextUp.position} of ${deck.length}` : 'Start session'}
          </PrimaryButton>
        )}
      </div>
    </div>
  )
}
