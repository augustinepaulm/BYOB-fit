import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { listAllSessions } from '../db/index.ts'
import { formatLongDate, toISODate } from '../lib/dates.ts'
import { parseSet, type ParsedFields } from '../lib/parseSet.ts'
import {
  formatClock,
  formatRest,
  formatSetValue,
  prescriptionText,
} from '../lib/prescription.ts'
import { dayForDate } from '../lib/program.ts'
import {
  buildDeck,
  findEntry,
  findReferenceEntry,
  findSet,
  isSetConfirmed,
  isSetFlagged,
  nearestWeightAbove,
  referenceSet,
  setRowsFor,
  summarise,
  type DeckItem,
  type SetRow,
} from '../lib/session.ts'
import { useProgram } from '../program/useProgram.ts'
import { useSession } from '../session/useSession.ts'
import type { ItemFields } from '../types/program.ts'
import type { Session, SetLog } from '../types/stores.ts'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  PlayIcon,
} from '../ui/icons.tsx'

function rowKey(itemId: string, row: SetRow): string {
  return `${itemId}:${row.n}:${row.side ?? ''}`
}

/** Pre-fill when there is no reference: the prescription, and no weight. */
function prescriptionPrefill(resolved: ItemFields): ParsedFields {
  switch (resolved.type) {
    case 'timed_hold':
      return { seconds: resolved.holdSec }
    case 'distance':
      return { distanceM: resolved.distanceM }
    case 'cardio_block':
      return { minutes: resolved.minutes }
    default:
      return { reps: resolved.repMin }
  }
}

function referencePrefill(set: SetLog): ParsedFields {
  return {
    weight: set.weight,
    reps: set.reps,
    seconds: set.seconds,
    distanceM: set.distanceM,
    minutes: set.minutes,
  }
}

function hasValue(fields: ParsedFields): boolean {
  return formatSetValue(fields) !== ''
}

/** Put the focused row in the top half of the viewport (task 9). */
function scrollIntoTopHalf(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const top = window.scrollY + rect.top - window.innerHeight * 0.25
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

export function DeckScreen() {
  const { program, today, week, weekPlan } = useProgram()
  const navigate = useNavigate()

  const day = program ? dayForDate(program, weekPlan, today) : null
  const scheduled = program?.days.find((d) => d.order === today.getDay())
  const swapped = Boolean(scheduled && day && scheduled.id !== day.id)

  const target = useMemo(
    () =>
      day
        ? {
            date: toISODate(today),
            dayId: day.id,
            programWeek: week,
            swapped,
          }
        : null,
    [day, today, week, swapped],
  )
  const api = useSession(target)

  const deck = useMemo(() => (day ? buildDeck(day, week) : []), [day, week])

  // Where the user has navigated to with Done or Back. Null until they move.
  const [position, setPosition] = useState<number | null>(null)
  // Where Resume dropped them, decided once when the stored session arrives.
  // Deriving this every render would jump the deck forward the moment a set
  // was confirmed, because the current item would stop being "incomplete".
  const [startAt, setStartAt] = useState<number | null>(null)
  const [phase, setPhase] = useState<'deck' | 'summary'>('deck')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [holdStart, setHoldStart] = useState<Record<string, number>>({})
  const [cardioStart, setCardioStart] = useState<number | null>(null)
  // Keyed by position, so moving to another item closes it without an effect.
  const [howToAt, setHowToAt] = useState<number | null>(null)
  const [history, setHistory] = useState<Session[]>([])
  const [now, setNow] = useState(Date.now)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // One ticker drives the rest timer, hold timers and cardio timer. All of them
  // read Date.now(), so backgrounding the tab cannot make them drift.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let live = true
    void listAllSessions().then((found) => {
      if (live) setHistory(found)
    })
    return () => {
      live = false
    }
  }, [])

  // Resume reopens at the first item with nothing recorded against it.
  const firstIncomplete = deck.findIndex((deckItem) => {
    const recorded = findEntry(api.session ?? undefined, deckItem.item.id)
    if (deckItem.logged) return !(recorded?.sets ?? []).some(isSetConfirmed)
    return recorded?.checked !== true
  })
  if (!api.loading && startAt === null && deck.length > 0) {
    setStartAt(
      firstIncomplete === -1 ? Math.max(0, deck.length - 1) : firstIncomplete,
    )
  }
  const at = position ?? startAt ?? 0
  const howToOpen = howToAt === at
  const current: DeckItem | undefined = deck[at]
  const entry = findEntry(api.session ?? undefined, current?.item.id ?? '')
  const exerciseId = entry?.exerciseId ?? current?.resolved.exerciseId ?? ''
  const referenceEntry = useMemo(
    () =>
      day ? findReferenceEntry(history, day.id, exerciseId) : undefined,
    [history, day, exerciseId],
  )

  const prefillFor = useCallback(
    (row: SetRow): { fields: ParsedFields; firstTime: boolean } => {
      const reference = referenceSet(referenceEntry, row)
      if (reference) return { fields: referencePrefill(reference), firstTime: false }
      return {
        fields: current ? prescriptionPrefill(current.resolved) : {},
        firstTime: true,
      }
    },
    [referenceEntry, current],
  )

  const startRest = useCallback(() => {
    const restSec = current?.resolved.restSec
    if (restSec && restSec > 0) setRestUntil(Date.now() + restSec * 1000)
  }, [current])

  const commitRow = useCallback(
    async (row: SetRow, text: string) => {
      if (!current) return
      const key = rowKey(current.item.id, row)
      const reference = referenceSet(referenceEntry, row)
      const result = parseSet(text, {
        type: current.resolved.type ?? 'load_reps',
        reference,
        // The row's own pre-fill load: this session first, then last week.
        inheritWeight: nearestWeightAbove(entry, row) ?? reference?.weight,
      })
      const base: SetLog = { n: row.n, ...(row.side ? { side: row.side } : {}) }
      if (result.ok) {
        await api.writeSet(current.item.id, exerciseId, {
          ...base,
          ...result.fields,
        })
        startRest()
      } else {
        // Never a silent zero: the raw text is kept and the row is flagged.
        await api.writeSet(current.item.id, exerciseId, {
          ...base,
          raw: result.raw,
        })
      }
      setDrafts((d) => {
        const next = { ...d }
        delete next[key]
        return next
      })
    },
    [api, current, entry, exerciseId, referenceEntry, startRest],
  )

  const confirmPrefill = useCallback(
    async (row: SetRow) => {
      if (!current) return
      const { fields } = prefillFor(row)
      if (!hasValue(fields)) return
      await api.writeSet(current.item.id, exerciseId, {
        n: row.n,
        ...(row.side ? { side: row.side } : {}),
        ...fields,
      })
      startRest()
    },
    [api, current, exerciseId, prefillFor, startRest],
  )

  const advance = useCallback(
    (from: number) => {
      if (from >= deck.length - 1) {
        setPhase('summary')
        window.scrollTo({ top: 0 })
        return
      }
      setPosition(from + 1)
      window.scrollTo({ top: 0 })
    },
    [deck.length],
  )

  /** Done: confirm every pending row from its pre-fill, then advance. */
  const done = useCallback(async () => {
    if (!current) return
    const from = deck.indexOf(current)
    if (!current.logged || current.resolved.type === 'check') {
      await api.setChecked(current.item.id, exerciseId, true)
      advance(from)
      return
    }
    for (const row of setRowsFor(current.resolved)) {
      const key = rowKey(current.item.id, row)
      const draft = drafts[key]
      const stored = findSet(entry, row)
      if (draft !== undefined && draft.trim() !== '') {
        await commitRow(row, draft)
      } else if (!stored) {
        await confirmPrefill(row)
      }
    }
    advance(from)
  }, [api, current, deck, exerciseId, drafts, entry, commitRow, confirmPrefill, advance])

  const finish = useCallback(async () => {
    await api.finish()
    navigate('/', { replace: true })
  }, [api, navigate])

  // Wait for the stored session before choosing where to resume.
  if (!program || !day || api.loading) return null
  if (!day.rest && startAt === null) return null

  if (day.rest) {
    // A rest day has no deck; its daily items are checked off on Today.
    return (
      <div className="page">
        <div className="page-head">
          <h1 className="page-title">Rest day</h1>
        </div>
        <p className="muted-line">Nothing to run today.</p>
      </div>
    )
  }

  const summary = summarise(api.session ?? undefined, deck)
  const restRemaining = restUntil ? (restUntil - now) / 1000 : 0

  if (phase === 'summary') {
    const meta = [
      formatLongDate(today),
      day.focus ?? day.name,
      `Week ${week} of ${program.programWeeks}`,
    ].join(' · ')
    return (
      <div className="deck">
        <div className="deck-progress">
          <div
            className="deck-progress__fill deck-progress__fill--done"
            style={{ width: '100%' }}
          />
        </div>
        <div className="summary-head">
          <div className="summary-head__meta">{meta}</div>
          <h1 className="summary-head__title">Session complete</h1>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card__value">{summary.setsConfirmed}</div>
            <div className="stat-card__label">sets completed</div>
          </div>
          {summary.volumeByUnit.map(({ unit, volume }) => (
            <div className="stat-card" key={unit}>
              <div className="stat-card__value">
                {volume.toLocaleString('en-US')}
              </div>
              <div className="stat-card__label">volume, {unit}</div>
            </div>
          ))}
          <div className="stat-card">
            <div className="stat-card__value">
              {summary.durationMin === null
                ? `${Math.max(
                    0,
                    Math.round(
                      (now - new Date(api.session?.startedAt ?? now).getTime()) /
                        60000,
                    ),
                  )} min`
                : `${summary.durationMin} min`}
            </div>
            <div className="stat-card__label">duration</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{summary.skipped}</div>
            <div className="stat-card__label">items skipped</div>
          </div>
        </div>
        {swapped && (
          <div className="banner" style={{ marginTop: 12 }}>
            <span>Logged as {day.name}&apos;s session (days swapped)</span>
          </div>
        )}
        <div className="summary-actions">
          <button type="button" className="btn-finish" onClick={() => void finish()}>
            Finish
          </button>
        </div>
      </div>
    )
  }

  if (!current) return null

  const next = deck[at + 1]
  const third = deck[at + 2]
  const exercise = program.exercises[exerciseId]
  const alternateId = current.resolved.alternateExerciseId
  const onAlternate = alternateId !== undefined && exerciseId === alternateId
  const swapTo = onAlternate ? current.resolved.exerciseId : alternateId
  const prescription = [
    prescriptionText(current.resolved),
    current.resolved.tempo ? `tempo ${current.resolved.tempo}` : null,
    current.resolved.restSec ? `rest ${formatRest(current.resolved.restSec)}` : null,
    current.resolved.rpe ? `RPE ${current.resolved.rpe}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const isCheckTile = !current.logged || current.resolved.type === 'check'
  const isCardioTile = current.logged && current.resolved.type === 'cardio_block'
  const checked = entry?.checked === true

  function renderField(row: SetRow, half: boolean) {
    if (!current) return null
    const key = rowKey(current.item.id, row)
    const stored = findSet(entry, row)
    const confirmed = isSetConfirmed(stored)
    const flagged = isSetFlagged(stored)
    const { fields, firstTime } = prefillFor(row)
    const draft = drafts[key]
    const running = holdStart[key]
    const shown = running
      ? formatClock((now - running) / 1000)
      : draft !== undefined
        ? draft
        : confirmed && stored
          ? formatSetValue(stored)
          : flagged
            ? (stored?.raw ?? '')
            : ''
    const className = [
      'field',
      confirmed && draft === undefined && !running ? 'field--confirmed' : '',
      flagged && draft === undefined && !running ? 'field--flagged' : '',
      (!confirmed && !flagged) || running ? 'field--active' : '',
      half ? 'field--half' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className={className} key={key} style={half ? { flex: 1 } : undefined}>
        {row.side && <span className="side-label">{row.side}</span>}
        <input
          type="text"
          value={shown}
          readOnly={running !== undefined}
          placeholder={formatSetValue(fields)}
          aria-label={`Set ${row.n}${row.side ? ` ${row.side}` : ''}${firstTime ? ', first time' : ''}`}
          onFocus={(event) => {
            const container = rowRefs.current[`${current.item.id}:${row.n}`]
            if (container) scrollIntoTopHalf(container)
            event.currentTarget.select()
          }}
          onChange={(event) =>
            setDrafts((d) => ({ ...d, [key]: event.target.value }))
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          onBlur={() => {
            if (draft === undefined) return
            if (draft.trim() === '') {
              setDrafts((d) => {
                const nextDrafts = { ...d }
                delete nextDrafts[key]
                return nextDrafts
              })
              return
            }
            void commitRow(row, draft)
          }}
        />
        {!confirmed && !flagged && draft === undefined && hasValue(fields) && (
          <button
            type="button"
            className="field__confirm"
            onClick={() => void confirmPrefill(row)}
          >
            confirm
          </button>
        )}
      </div>
    )
  }

  function renderHoldButton(row: SetRow) {
    if (!current) return null
    const key = rowKey(current.item.id, row)
    const startedAt = holdStart[key]
    return (
      <button
        type="button"
        className={startedAt ? 'hold-btn hold-btn--running' : 'hold-btn'}
        aria-label={startedAt ? 'Stop hold timer' : 'Start hold timer'}
        onClick={() => {
          if (startedAt) {
            const seconds = Math.round((Date.now() - startedAt) / 1000)
            setHoldStart((h) => {
              const nextHolds = { ...h }
              delete nextHolds[key]
              return nextHolds
            })
            void api
              .writeSet(current.item.id, exerciseId, {
                n: row.n,
                ...(row.side ? { side: row.side } : {}),
                seconds,
              })
              .then(startRest)
          } else {
            setHoldStart((h) => ({ ...h, [key]: Date.now() }))
          }
        }}
      >
        {startedAt ? <span className="hold-stop" /> : <PlayIcon />}
      </button>
    )
  }

  const setNumbers = Array.from(
    { length: Math.max(1, current.resolved.sets ?? 1) },
    (_, i) => i + 1,
  )

  return (
    <div className="deck">
      <div className="deck-head">
        <span className="deck-head__section">
          {current.section.title} · {current.position} of {deck.length}
        </span>
        {restRemaining > 0 && (
          <span className="deck-rest">
            <span className="deck-rest__label">rest</span>
            <span className="deck-rest__value">{formatClock(restRemaining)}</span>
          </span>
        )}
        <button
          type="button"
          className="deck-end"
          onClick={() => {
            setPhase('summary')
            window.scrollTo({ top: 0 })
          }}
        >
          End
        </button>
      </div>
      <div className="deck-progress">
        <div
          className="deck-progress__fill"
          style={{ width: `${(current.position / deck.length) * 100}%` }}
        />
      </div>

      <div className="tile">
        <div className="tile__name">
          <span>{exercise?.name ?? exerciseId}</span>
          {current.resolved.index && <span className="index-tag">index</span>}
        </div>
        {prescription && <div className="tile__prescription">{prescription}</div>}
        {current.resolved.cue && <div className="tile__cue">{current.resolved.cue}</div>}

        {swapTo && (
          <button
            type="button"
            className="tile__alternate"
            onClick={() => void api.chooseExercise(current.item.id, swapTo)}
          >
            Use {program.exercises[swapTo]?.name ?? swapTo} instead
          </button>
        )}

        {isCheckTile ? (
          <div className="check-tile" style={{ marginTop: 14 }}>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className={checked ? 'check-box check-box--on' : 'check-box'}
              aria-label={checked ? 'Checked' : 'Not checked'}
              onClick={() =>
                void api.setChecked(current.item.id, exerciseId, !checked)
              }
            >
              <CheckIcon size={26} />
            </button>
          </div>
        ) : isCardioTile ? (
          <>
            <div className="cardio-row">
              <span className="cardio-timer">
                {formatClock(cardioStart ? (now - cardioStart) / 1000 : 0)}
              </span>
              <button
                type="button"
                className={cardioStart ? 'hold-btn hold-btn--running' : 'hold-btn'}
                aria-label={cardioStart ? 'Stop timer' : 'Start timer'}
                onClick={() => {
                  if (cardioStart) {
                    const minutes = Math.max(
                      1,
                      Math.round((Date.now() - cardioStart) / 60000),
                    )
                    setCardioStart(null)
                    setDrafts((d) => ({
                      ...d,
                      [rowKey(current.item.id, { n: 1 })]: String(minutes),
                    }))
                  } else {
                    setCardioStart(Date.now())
                  }
                }}
              >
                {cardioStart ? <span className="hold-stop" /> : <PlayIcon />}
              </button>
              <div className="cardio-minutes">
                <span className="cardio-minutes__label">minutes</span>
                <input
                  type="text"
                  aria-label="Minutes"
                  value={
                    drafts[rowKey(current.item.id, { n: 1 })] ??
                    (findSet(entry, { n: 1 })?.minutes !== undefined
                      ? String(findSet(entry, { n: 1 })?.minutes)
                      : '')
                  }
                  placeholder={String(current.resolved.minutes ?? '')}
                  onChange={(event) =>
                    setDrafts((d) => ({
                      ...d,
                      [rowKey(current.item.id, { n: 1 })]: event.target.value,
                    }))
                  }
                  onBlur={(event) => {
                    const text = event.target.value
                    if (text.trim() === '') return
                    void commitRow({ n: 1 }, text)
                  }}
                />
              </div>
            </div>
            <textarea
              className="note-field"
              placeholder="Note"
              aria-label="Session note"
              defaultValue={entry?.note ?? ''}
              onBlur={(event) =>
                void api.setNote(current.item.id, exerciseId, event.target.value)
              }
            />
          </>
        ) : (
          <div className="tile__rows">
            {setNumbers.map((n) => {
              const rows: SetRow[] = current.resolved.perSide
                ? [
                    { n, side: 'L' as const },
                    { n, side: 'R' as const },
                  ]
                : [{ n }]
              const flaggedRow = rows.find((row) =>
                isSetFlagged(findSet(entry, row)),
              )
              const holdRow =
                current.resolved.type === 'timed_hold'
                  ? (rows.find((row) => !isSetConfirmed(findSet(entry, row))) ??
                    rows[rows.length - 1])
                  : null
              const allConfirmed = rows.every((row) =>
                isSetConfirmed(findSet(entry, row)),
              )
              return (
                <div key={n}>
                  <div
                    className="set-row"
                    ref={(element) => {
                      rowRefs.current[`${current.item.id}:${n}`] = element
                    }}
                  >
                    <span className="set-row__n">{n}</span>
                    <span className="set-row__ref">
                      {formatSetValue(prefillFor(rows[0]).fields)}
                    </span>
                    {current.resolved.perSide ? (
                      <div className="side-pair">
                        {rows.map((row) => renderField(row, true))}
                      </div>
                    ) : (
                      renderField(rows[0], false)
                    )}
                    {holdRow ? (
                      renderHoldButton(holdRow)
                    ) : (
                      <span className="set-row__mark">
                        {allConfirmed && (
                          <span style={{ color: 'var(--ok)' }}>
                            <CheckIcon size={24} />
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {flaggedRow && (
                    <div className="flag-msg">Couldn&apos;t read this, tap to fix</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {exercise?.howTo && (
          <>
            <button
              type="button"
              className="howto"
              aria-expanded={howToOpen}
              onClick={() => setHowToAt((open) => (open === at ? null : at))}
            >
              <span>How to perform</span>
              <span
                style={{
                  color: 'var(--icon-muted)',
                  transform: howToOpen ? 'rotate(180deg)' : undefined,
                  display: 'inline-flex',
                }}
              >
                <ChevronDownIcon />
              </span>
            </button>
            {howToOpen && <div className="howto__body">{exercise.howTo}</div>}
          </>
        )}

        <div className="deck-actions">
          <button
            type="button"
            className="deck-back"
            aria-label="Previous item"
            disabled={at === 0}
            onClick={() => {
              setPosition(Math.max(0, at - 1))
              window.scrollTo({ top: 0 })
            }}
          >
            <ChevronLeftIcon />
          </button>
          <button type="button" className="deck-done" onClick={() => void done()}>
            Done
          </button>
        </div>
      </div>

      {next && (
        <div className="next-tile">
          <span className="next-tile__name">
            {program.exercises[next.resolved.exerciseId ?? '']?.name ??
              next.resolved.exerciseId}
          </span>
          <span className="next-tile__prescription">
            {[
              prescriptionText(next.resolved),
              next.resolved.restSec ? `rest ${formatRest(next.resolved.restSec)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      )}
      {third && (
        <div className="third-tile">
          {program.exercises[third.resolved.exerciseId ?? '']?.name ??
            third.resolved.exerciseId}
        </div>
      )}
    </div>
  )
}
