// Profile, frame 5b in the 1b layout (EXEC-11 task 3): goal, program, current
// stats, and the free label and value fields kept below. Only what the user
// entered; the app computes nothing here (PLAN section 4).

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getGoals, getProfile, listBodyEntries, listSentLog, saveProfile } from '../db/index.ts'
import { toISODate } from '../lib/dates.ts'
import { ACTIVITY_OPTIONS, fromGoals, goalSummary, profileDraft } from '../lib/goals.ts'
import { fibreTarget } from '../lib/nutrients.ts'
import { LEVEL_LABEL } from '../lib/payload.ts'
import { computeTargets } from '../lib/targets.ts'
import { budgetOf, formatUsd, monthUsage, pricesOf, sameLocalMonth } from '../lib/usage.ts'
import { useProgram } from '../program/useProgram.ts'
import { appearanceOf, privacyLevelOf, unitsOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Program } from '../types/program.ts'
import type { BodyEntry, Goals, SentLogEntry } from '../types/stores.ts'
import { GearIcon } from '../ui/icons.tsx'
import { AppHeader, ListGroup, ListRow } from '../ui/shell.tsx'

interface Row {
  key: string
  label: string
  value: string
}

let nextKey = 0
function rowsFrom(fields: Record<string, string>): Row[] {
  return Object.entries(fields).map(([label, value]) => ({
    key: `r${nextKey++}`,
    label,
    value,
  }))
}

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** "Sep 13 – Dec 5": the program's first and last day. */
function programSpan(program: Pick<Program, 'startDate' | 'programWeeks'>): string {
  const [y, m, d] = program.startDate.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + program.programWeeks * 7 - 1)
  return `${MONTH_DAY.format(start)} – ${MONTH_DAY.format(end)}`
}

/** Current stats as Profile lists them, with D-050 rule 3's line under each. */
function statRows(goals: Goals | null, unit: 'kg' | 'lb'): { label: string; value: string | null; privacy: string }[] {
  const s = goals?.currentStats
  const d = profileDraft(s, unit)
  const height = s?.heightCm === undefined ? null : unit === 'lb' ? `${d.feet} ft ${d.inches} in` : `${s.heightCm} cm`
  return [
    { label: 'Weight', value: s?.weight !== undefined ? `${s.weight} ${s.weightUnit ?? unit}` : null, privacy: 'Sent only at the Full privacy level' },
    { label: 'Body fat', value: s?.bodyFatPct !== undefined ? `${s.bodyFatPct}%` : null, privacy: 'Never sent' },
    { label: 'Height', value: height, privacy: 'Never sent' },
    { label: 'Age', value: s?.age !== undefined ? String(s.age) : null, privacy: 'Never sent' },
    { label: 'Sex', value: s?.sex ? (s.sex === 'male' ? 'Male' : 'Female') : null, privacy: 'Never sent' },
    { label: 'Activity', value: ACTIVITY_OPTIONS.find((a) => a.value === s?.activity)?.title ?? null, privacy: 'Never sent' },
  ]
}

export function ProfileScreen() {
  const navigate = useNavigate()
  const { program, week, today } = useProgram()
  const { settings } = useSettings()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [goals, setGoals] = useState<Goals | null | undefined>(undefined)
  const [body, setBody] = useState<BodyEntry[]>([])
  const [log, setLog] = useState<SentLogEntry[]>([])

  useEffect(() => {
    let live = true
    void getProfile().then((profile) => {
      if (live) setRows(rowsFrom(profile?.fields ?? {}))
    })
    void getGoals().then((found) => live && setGoals(found ?? null))
    void listBodyEntries().then((found) => live && setBody(found))
    void listSentLog().then((found) => live && setLog(found))
    return () => {
      live = false
    }
  }, [])

  async function persist(next: Row[]) {
    setRows(next)
    const fields: Record<string, string> = {}
    for (const row of next) {
      const label = row.label.trim()
      if (label !== '') fields[label] = row.value
    }
    await saveProfile({ fields, updatedAt: new Date().toISOString() })
  }

  if (rows === null || goals === undefined) return null

  const summary = goals ? goalSummary(fromGoals(goals), goals.timeframeWeeks, (id) => program?.exercises[id]?.name) : null
  const unit = unitsOf(settings)
  const targets = computeTargets(goals, body, toISODate(today))
  const fibre = fibreTarget(targets.kcal, goals?.currentStats)
  const targetLine = [
    targets.kcal !== undefined ? `Calorie target ${targets.kcal.toLocaleString('en-US')}` : null,
    targets.proteinG !== undefined ? `protein ${targets.proteinG} g` : null,
    fibre !== undefined ? `fibre ${fibre} g` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const stats = goals?.currentStats
  const personal = [stats?.heightCm !== undefined ? (unit === 'lb' ? `${Math.round(stats.heightCm / 2.54)} in` : `${stats.heightCm} cm`) : null, stats?.age, stats?.sex].filter((v) => v !== undefined && v !== null)
  const usage = monthUsage(log, pricesOf(settings), new Date())
  const budget = budgetOf(settings)
  const thisMonth = log.filter((e) => sameLocalMonth(e.at, new Date())).length

  return (
    <div className="screen">
      <AppHeader title="Profile" action={<button type="button" className="pf-gear" aria-label="Settings" onClick={() => navigate('/settings')}><GearIcon /></button>} />

      <ListGroup title="Goals">
        {summary ? (
          <ListRow title={summary} sub={targetLine || undefined} onClick={() => navigate('/goal')} />
        ) : (
          <ListRow title="No goal yet" sub="A goal helps the AI review your program. It’s optional." value="Set" onClick={() => navigate('/goal')} />
        )}
        <ListRow title="Height, age and sex" value={personal.length ? personal.join(', ') : 'Not set'} onClick={() => navigate('/goal')} />
      </ListGroup>

      <ListGroup title="Program">
        {program ? (
          <>
            <ListRow title={program.name} sub={`Week ${week} of ${program.programWeeks} · ${programSpan(program)}`} onClick={() => navigate('/week')} />
            <ListRow title="Edit program" onClick={() => navigate('/program/edit')} />
            <ListRow title="Start a new program" onClick={() => navigate('/program/new')} />
          </>
        ) : (
          <>
            <ListRow title="No program yet" sub="Pick a starter program or build your own." value="Pick" onClick={() => navigate('/program/new')} />
            <ListRow title="Build my own" onClick={() => navigate('/program/new', { state: { build: true } })} />
          </>
        )}
      </ListGroup>

      <ListGroup title="Current stats" aside={<span className="pf-lock">Stored on this phone</span>}>
        {statRows(goals, unit).map((stat) => (
          <ListRow key={stat.label} title={stat.label} sub={stat.privacy} value={stat.value ?? 'Add'} onClick={() => navigate('/goal')} />
        ))}
      </ListGroup>

      <ListGroup title="Settings">
        <ListRow title="Units" value={unit} onClick={() => navigate('/settings')} />
        <ListRow title="Appearance" value={APPEARANCE_WORD[appearanceOf(settings)]} onClick={() => navigate('/settings')} />
        <ListRow title="AI" value={settings.apiKey ? 'Key saved' : 'Not set up'} onClick={() => navigate('/settings/ai')} />
        <ListRow title="Privacy level" value={LEVEL_LABEL[privacyLevelOf(settings)]} onClick={() => navigate('/settings/privacy')} />
        <ListRow title="AI usage and budget" value={budget.monthlyUsd ? `${formatUsd(usage.cost)} of ${formatUsd(budget.monthlyUsd)}` : formatUsd(usage.cost)} onClick={() => navigate('/settings/usage')} />
        <ListRow title="Export data" onClick={() => navigate('/settings', { state: { export: true } })} />
        <ListRow title="Import data" onClick={() => navigate('/settings')} />
        <ListRow title="Sent log" value={`${thisMonth} ${thisMonth === 1 ? 'send' : 'sends'}`} onClick={() => navigate('/settings/sent-log')} />
        <ListRow title="Privacy" onClick={() => navigate('/settings/privacy-page')} />
        <ListRow title="All settings" onClick={() => navigate('/settings')} />
      </ListGroup>

      <ListGroup title="Other details">
        {rows.length === 0 && (
          <p className="pf-empty">Nothing here yet. Add the fields you want the reprogramming prompt to know about — a goal, targets, anything you choose to enter.</p>
        )}
        {rows.map((row, i) => (
          <div className="profile-row pf-field" key={row.key}>
            <input
              className="profile-row__label"
              aria-label={`Field ${i + 1} label`}
              placeholder="Label"
              value={row.label}
              onChange={(event) => {
                const next = [...rows]
                next[i] = { ...row, label: event.target.value }
                setRows(next)
              }}
              onBlur={() => void persist(rows)}
            />
            <input
              className="profile-row__value"
              aria-label={`Field ${i + 1} value`}
              placeholder="Value"
              value={row.value}
              onChange={(event) => {
                const next = [...rows]
                next[i] = { ...row, value: event.target.value }
                setRows(next)
              }}
              onBlur={() => void persist(rows)}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${row.label || `field ${i + 1}`}`}
              onClick={() => void persist(rows.filter((_, at) => at !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="ob-add" onClick={() => setRows([...rows, { key: `r${nextKey++}`, label: '', value: '' }])}>
          <span>+</span>
          Add field
        </button>
      </ListGroup>
      <p className="note-v3">Everything stays on this phone. BYOB-fit is free and open source.</p>
    </div>
  )
}

const APPEARANCE_WORD: Record<string, string> = { system: 'Match phone', light: 'Light', dark: 'Dark' }
