import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { listAllSessions } from '../db/index.ts'
import { formatShortDay } from '../lib/dates.ts'
import {
  bestSetOf,
  buildExerciseLog,
  topSetSeries,
  weeksSpanned,
  type ExerciseSession,
} from '../lib/log.ts'
import { formatSetValue } from '../lib/prescription.ts'
import { parseISODate, resolveItem } from '../lib/program.ts'
import { useProgram } from '../program/useProgram.ts'
import type { Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '../ui/icons.tsx'

const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

/** Exercise ids the program marks as index lifts for the current week. */
function indexExerciseIds(program: Program, week: number): Set<string> {
  const ids = new Set<string>()
  for (const day of program.days) {
    for (const section of day.sections) {
      for (const item of section.items) {
        const resolved = resolveItem(item, week)
        if (resolved.index && resolved.exerciseId) ids.add(resolved.exerciseId)
      }
    }
  }
  return ids
}

function useSessions(): Session[] {
  const [sessions, setSessions] = useState<Session[]>([])
  useEffect(() => {
    let live = true
    void listAllSessions().then((found) => {
      if (live) setSessions(found)
    })
    return () => {
      live = false
    }
  }, [])
  return sessions
}

function Sparkline({ points }: { points: { date: string; value: number }[] }) {
  if (points.length === 0) return null
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) =>
    points.length === 1 ? 118 : 2 + (i / (points.length - 1)) * 116
  const y = (value: number) => 28 - ((value - min) / span) * 22
  const last = points.length - 1
  return (
    <svg
      width="100%"
      height="34"
      viewBox="0 0 120 34"
      preserveAspectRatio="none"
      style={{ marginTop: 6 }}
      aria-hidden="true"
    >
      {points.length > 1 && (
        <polyline
          points={points.map((point, i) => `${x(i)},${y(point.value)}`).join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      <circle cx={x(last)} cy={y(points[last].value)} r="3" fill="var(--accent)" />
    </svg>
  )
}

export function LogScreen() {
  const { program, week } = useProgram()
  const sessions = useSessions()
  const [query, setQuery] = useState('')
  const [indexOnly, setIndexOnly] = useState(false)

  const history = useMemo(() => buildExerciseLog(sessions), [sessions])
  const indexIds = useMemo(
    () => (program ? indexExerciseIds(program, week) : new Set<string>()),
    [program, week],
  )

  if (!program) return null

  const rows = Object.entries(program.exercises)
    .map(([id, exercise]) => {
      const logged = history.get(id) ?? []
      const best = bestSetOf(logged.flatMap((item) => item.sets))
      return { id, name: exercise.name, logged, best }
    })
    .filter((row) => (indexOnly ? indexIds.has(row.id) : true))
    .filter((row) =>
      query.trim() === ''
        ? true
        : row.name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    // Exercises with at least one logged set come first.
    .sort((a, b) => {
      if ((a.logged.length > 0) !== (b.logged.length > 0)) {
        return a.logged.length > 0 ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Log</h1>
      </div>
      <div className="search">
        <span style={{ color: 'var(--icon-muted)', display: 'inline-flex' }}>
          <SearchIcon />
        </span>
        <input
          type="text"
          value={query}
          placeholder="Search exercises"
          aria-label="Search exercises"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="filter-row">
        <button
          type="button"
          className={indexOnly ? 'toggle-chip toggle-chip--on' : 'toggle-chip'}
          aria-pressed={indexOnly}
          onClick={() => setIndexOnly((on) => !on)}
        >
          Index lifts
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="muted-line">No exercises match.</p>
      ) : (
        <div className="card">
          {rows.map((row) => (
            <Link className="log-row" to={`/log/${row.id}`} key={row.id}>
              <div>
                <div className="log-row__name">{row.name}</div>
                <div className="log-row__meta">
                  {row.best
                    ? `best ${formatSetValue(row.best)} · last ${formatShortDay(
                        parseISODate(row.logged[0].date),
                      )}`
                    : 'no sets logged yet'}
                </div>
              </div>
              <span style={{ color: 'var(--chip-idle)', display: 'inline-flex' }}>
                <ChevronRightIcon size={16} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function ExerciseLogScreen() {
  const { program } = useProgram()
  const { exerciseId = '' } = useParams()
  const navigate = useNavigate()
  const sessions = useSessions()
  const history = useMemo(() => buildExerciseLog(sessions), [sessions])

  if (!program) return null
  const exercise = program.exercises[exerciseId]
  const logged: ExerciseSession[] = history.get(exerciseId) ?? []
  const best = bestSetOf(logged.flatMap((item) => item.sets))
  const series = topSetSeries(logged)

  return (
    <div className="page">
      <div className="sub-head">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
        </button>
        <div className="sub-head__title">{exercise?.name ?? exerciseId}</div>
      </div>

      {logged.length === 0 ? (
        <p className="muted-line">No sets logged yet.</p>
      ) : (
        <>
          <div className="log-cards">
            <div className="log-card">
              <div className="log-card__label">Best set</div>
              <div className="log-card__value">
                {best ? formatSetValue(best) : '—'}
              </div>
            </div>
            <div className="log-card log-card--wide">
              <div className="log-card__label">
                Top-set weight, {weeksSpanned(series)} wk
              </div>
              <Sparkline points={series} />
            </div>
          </div>

          <div className="section-label">Sessions</div>
          <div className="card">
            {logged.map((item) => (
              <div className="session-row" key={item.date}>
                <span className="session-row__date">
                  {MONTH_DAY.format(parseISODate(item.date))}
                </span>
                <span className="session-row__sets">
                  {item.sets.map((set) => formatSetValue(set)).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
