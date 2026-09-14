import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { formatLongDate, toISODate } from '../lib/dates.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { dayForDate, isLogged, resolveItem } from '../lib/program.ts'
import {
  buildDeck,
  findEntry,
  isSetConfirmed,
  summarise,
} from '../lib/session.ts'
import { useProgram } from '../program/useProgram.ts'
import { useSession } from '../session/useSession.ts'
import type { Program, Section } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { CheckIcon, RestIcon, SwapIcon } from '../ui/icons.tsx'

function ItemRow({
  name,
  cue,
  index,
  prescription,
  big,
  check,
}: {
  name: string
  cue?: string
  index?: boolean
  prescription: string
  big: boolean
  check?: { on: boolean; onToggle: () => void }
}) {
  const body = (
    <>
      <div className="row__name">
        <span>{name}</span>
        {index && <span className="index-tag">index</span>}
        {cue && <span className="row__cue">{cue}</span>}
      </div>
      {prescription && <span className="row__prescription">{prescription}</span>}
      {check && (
        <span className={check.on ? 'row__check row__check--on' : 'row__check'}>
          <CheckIcon size={16} />
        </span>
      )}
    </>
  )
  if (!check) {
    return <div className={big ? 'row row--main' : 'row'}>{body}</div>
  }
  return (
    <button
      type="button"
      className={`row row--checkable${big ? ' row--main' : ''}`}
      aria-pressed={check.on}
      onClick={check.onToggle}
    >
      {body}
    </button>
  )
}

function SectionCard({
  section,
  program,
  week,
  session,
  onToggle,
}: {
  section: Section
  program: Program
  week: number
  session?: Session
  /** Present only where the screen owns the check-off (rest days). */
  onToggle?: (itemId: string, exerciseId: string, next: boolean) => void
}) {
  if (section.items.length === 0) return null
  const big = section.kind === 'main'
  return (
    <>
      <div className="section-label">{section.title}</div>
      <div className="card">
        {section.items.map((item) => {
          const resolved = resolveItem(item, week)
          const exerciseId = resolved.exerciseId ?? ''
          const exercise = program.exercises[exerciseId]
          const logged = isLogged(section.kind, resolved)
          const entry = findEntry(session, item.id)
          return (
            <ItemRow
              key={resolved.id}
              name={exercise?.name ?? exerciseId}
              cue={resolved.cue}
              index={resolved.index}
              prescription={prescriptionText(resolved)}
              big={big}
              check={
                onToggle && !logged
                  ? {
                      on: entry?.checked === true,
                      onToggle: () =>
                        onToggle(item.id, exerciseId, entry?.checked !== true),
                    }
                  : undefined
              }
            />
          )
        })}
      </div>
    </>
  )
}

export function TodayScreen() {
  const { program, today, week, weekPlan } = useProgram()
  const navigate = useNavigate()

  const day = program ? dayForDate(program, weekPlan, today) : null
  const scheduled = program?.days.find((d) => d.order === today.getDay())
  const swapped = Boolean(scheduled && day && scheduled.id !== day.id)

  const target = useMemo(
    () =>
      day
        ? { date: toISODate(today), dayId: day.id, programWeek: week, swapped }
        : null,
    [day, today, week, swapped],
  )
  const api = useSession(target)

  const deck = useMemo(
    () => (day && program ? buildDeck(day, week) : []),
    [day, program, week],
  )

  if (!program || !day) return null

  const session = api.session ?? undefined
  const meta = `${formatLongDate(today)} · Week ${week} of ${program.programWeeks}`
  const finished = Boolean(session?.endedAt)

  if (day.rest) {
    const hasItems = day.sections.some((section) => section.items.length > 0)
    return (
      <div className="page">
        <div className="page-head">
          <div className="page-head__meta">{meta}</div>
          <h1 className="page-title">Rest day</h1>
        </div>
        {hasItems ? (
          <>
            <p className="muted-line" style={{ marginBottom: 4 }}>
              Recovery counts as training. Today&apos;s daily items:
            </p>
            {day.sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                program={program}
                week={week}
                session={session}
                onToggle={(itemId, exerciseId, next) =>
                  void api.setChecked(itemId, exerciseId, next)
                }
              />
            ))}
          </>
        ) : (
          <div className="empty">
            <div className="empty__ring">
              <RestIcon />
            </div>
            <div className="empty__title">Nothing scheduled</div>
            <div className="empty__body">
              Recovery counts as training. Daily items live on your next session.
            </div>
          </div>
        )}
      </div>
    )
  }

  const aside = [day.focus, day.durationMin ? `about ${day.durationMin} min` : null]
    .filter(Boolean)
    .join(' · ')

  // Resume points at the first item with nothing recorded against it.
  const nextUp = deck.find((deckItem) => {
    const entry = findEntry(session, deckItem.item.id)
    if (deckItem.logged) return !(entry?.sets ?? []).some(isSetConfirmed)
    return entry?.checked !== true
  })
  const started = session !== undefined && session.entries.length > 0
  const summary = summarise(session, deck)

  async function enterDeck() {
    await api.start()
    navigate('/deck')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__meta">{meta}</div>
        <div className="page-head__row">
          <h1 className="page-title">{day.name}</h1>
          {aside && <span className="page-head__aside">{aside}</span>}
        </div>
      </div>

      {swapped && (
        <div className="banner">
          <SwapIcon />
          <span>Swapped: this is {day.name}&apos;s session</span>
        </div>
      )}

      {day.sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          program={program}
          week={week}
          session={session}
        />
      ))}

      {finished && (
        <div className="done-line">
          <span>
            {summary.setsConfirmed} sets
            {summary.volumeByUnit.map(
              ({ unit, volume }) => ` · ${volume.toLocaleString('en-US')} ${unit}`,
            )}
            {summary.durationMin !== null ? ` · ${summary.durationMin} min` : ''}
          </span>
          <Link to="/log">View log</Link>
        </div>
      )}

      <div className="action-dock">
        {finished ? (
          <div className="btn-done-today">
            <CheckIcon size={20} />
            Done today
          </div>
        ) : (
          <button type="button" className="btn-primary" onClick={() => void enterDeck()}>
            {started && nextUp
              ? `Resume · ${nextUp.section.title}, ${nextUp.position} of ${deck.length}`
              : 'Start'}
          </button>
        )}
      </div>
    </div>
  )
}
