import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { listAllSessions, listPrograms } from '../db/index.ts'
import { formatShortDay } from '../lib/dates.ts'
import {
  bestSetChange,
  bestSetOf,
  buildExerciseLog,
  defaultWeeks,
  setsInWeek,
  topSetSeries,
  weeksSpanned,
  weeksWithExercise,
  type ExerciseSession,
} from '../lib/log.ts'
import { formatSetValue } from '../lib/prescription.ts'
import { parseISODate, resolveItem } from '../lib/program.ts'
import { useProgram } from '../program/useProgram.ts'
import type { Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { BuilderBar } from '../builder/ui.tsx'
import { SectionHead } from '../onboarding/ui.tsx'
import { ChevronRightIcon, SearchIcon } from '../ui/icons.tsx'

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

/**
 * Exercise names from every stored program, the active one first, so history
 * from an earlier program still reads by name (D-042 rule 6).
 */
function useExerciseNames(program: Program | null): Map<string, string> {
  const [stored, setStored] = useState<Program[]>([])
  useEffect(() => {
    let live = true
    void listPrograms().then((found) => {
      if (live) setStored(found)
    })
    return () => {
      live = false
    }
  }, [])
  return useMemo(() => {
    const names = new Map<string, string>()
    for (const p of program ? [program, ...stored] : stored) {
      for (const [id, exercise] of Object.entries(p.exercises)) {
        if (!names.has(id)) names.set(id, exercise.name)
      }
    }
    return names
  }, [program, stored])
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
  const names = useExerciseNames(program)
  const indexIds = useMemo(
    () => (program ? indexExerciseIds(program, week) : new Set<string>()),
    [program, week],
  )

  if (!program) return null

  // The active program's exercises, plus any logged under an earlier program.
  const ids = new Set([...Object.keys(program.exercises), ...history.keys()])
  const rows = [...ids]
    .map((id) => {
      const logged = history.get(id) ?? []
      const best = bestSetOf(logged.flatMap((item) => item.sets))
      return { id, name: names.get(id) ?? id, logged, best }
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
    <div className="tl">
      <div className="bd-hero">
        <h1 className="lg-title">Log</h1>
      </div>
      <label className="bd-search" style={{ margin: '16px 24px 0' }}>
        <span style={{ display: 'inline-flex', color: 'var(--muted)' }}>
          <SearchIcon />
        </span>
        <input
          type="search"
          value={query}
          placeholder="Search exercises"
          aria-label="Search exercises"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="bd-chips bd-chips--pad">
        <button
          type="button"
          className={indexOnly ? 'bd-chip bd-chip--on' : 'bd-chip'}
          aria-pressed={indexOnly}
          onClick={() => setIndexOnly((on) => !on)}
        >
          Index lifts
        </button>
      </div>
      <div style={{ margin: '12px 24px 24px', borderTop: '1.5px solid var(--text)' }}>
        {rows.length === 0 && <p className="bd-hint">No exercises match.</p>}
        {rows.map((row) => (
          <Link className="lg-row log-row" to={`/log/${row.id}`} key={row.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="lg-row__name log-row__name">{row.name}</div>
              <div className="lg-row__sub">
                {row.best
                  ? `Best ${formatSetValue(row.best)} · last ${formatShortDay(parseISODate(row.logged[0].date))}`
                  : 'No sets logged yet'}
              </div>
            </div>
            <span style={{ color: 'var(--muted)', display: 'inline-flex' }}>
              <ChevronRightIcon size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/** The unit this exercise's items use in the program, kg when none says. */
function unitFor(program: Program, exerciseId: string): string {
  for (const day of program.days) {
    for (const section of day.sections) {
      for (const item of section.items) {
        if (item.exerciseId === exerciseId && item.unit) return item.unit
      }
    }
  }
  return 'kg'
}

function WeekPicker({ label, value, weeks, onChange }: { label: string; value: number | null; weeks: number[]; onChange: (week: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--secondary)', marginBottom: 4 }}>{label}</div>
      <div className="bd-input" style={{ fontSize: 16 }}>
        <select aria-label={label} value={value ?? ''} onChange={(event) => onChange(Number(event.target.value))}>
          {value === null && <option value="">None</option>}
          {[...weeks].sort((a, b) => a - b).map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function ExerciseLogScreen() {
  const { program } = useProgram()
  const { exerciseId = '' } = useParams()
  const navigate = useNavigate()
  const sessions = useSessions()
  const history = useMemo(() => buildExerciseLog(sessions), [sessions])
  const names = useExerciseNames(program)
  const weeks = useMemo(() => weeksWithExercise(sessions, exerciseId), [sessions, exerciseId])
  const [picked, setPicked] = useState<{ from: number | null; to: number | null } | null>(null)

  if (!program) return null
  const logged: ExerciseSession[] = history.get(exerciseId) ?? []
  const series = topSetSeries(logged)
  // Defaults: the latest week with this exercise, and the one before it.
  const { from, to } = picked ?? defaultWeeks(weeks)
  const fromSets = from !== null ? setsInWeek(sessions, exerciseId, from) : []
  const toSets = to !== null ? setsInWeek(sessions, exerciseId, to) : []
  const fromBest = bestSetOf(fromSets)
  const toBest = bestSetOf(toSets)
  const change = bestSetChange(fromBest, toBest, unitFor(program, exerciseId))
  const count = Math.max(fromSets.length, toSets.length)

  return (
    <div className="tl" style={{ paddingBottom: 40 }}>
      <BuilderBar title="Log" onBack={() => navigate(-1)} />
      <div style={{ padding: '4px 24px 0' }}>
        <h1 className="dk-title__name">{names.get(exerciseId) ?? exerciseId}</h1>
      </div>

      {logged.length === 0 ? (
        <p className="bd-hint" style={{ margin: '16px 24px 0' }}>
          No sets logged yet.
        </p>
      ) : (
        <>
          <div className="lg-pickers">
            <WeekPicker label="Compare" value={from} weeks={weeks} onChange={(w) => setPicked({ from: w, to })} />
            <span className="lg-pickers__vs">vs</span>
            <WeekPicker label="with" value={to} weeks={weeks} onChange={(w) => setPicked({ from, to: w })} />
          </div>
          <div style={{ margin: '16px 24px 0', borderTop: '1.5px solid var(--text)' }}>
            <div className="lg-grid">
              <span className="lg-grid__label">Set</span>
              <span className="lg-grid__label">{from !== null ? `Week ${from}` : ''}</span>
              <span className="lg-grid__label">{to !== null ? `Week ${to}` : ''}</span>
            </div>
            {Array.from({ length: count }, (_, i) => (
              <div className="lg-grid" key={i}>
                <span className="lg-grid__label">{i + 1}</span>
                <span style={{ color: 'var(--secondary)' }}>{fromSets[i] ? formatSetValue(fromSets[i]) : ''}</span>
                <span style={{ fontWeight: 600 }}>{toSets[i] ? formatSetValue(toSets[i]) : ''}</span>
              </div>
            ))}
            <div className="lg-grid lg-grid--best">
              <span className="lg-grid__label">Best</span>
              <span>{fromBest ? formatSetValue(fromBest) : ''}</span>
              <span>{toBest ? formatSetValue(toBest) : ''}</span>
            </div>
          </div>
          {change && <div className="lg-change">{change}</div>}

          <div style={{ margin: '0 24px' }}>
            <SectionHead aside={`${weeksSpanned(series)} ${weeksSpanned(series) === 1 ? 'week' : 'weeks'}`}>Top-set weight</SectionHead>
            <Sparkline points={series} />
            <SectionHead>History</SectionHead>
            {logged.map((item) => (
              <div className="tl-row" key={item.date} style={{ alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--secondary)' }}>{MONTH_DAY.format(parseISODate(item.date))}</div>
                  <div style={{ fontSize: 15, color: 'var(--secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {item.sets.map((set) => formatSetValue(set)).join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
