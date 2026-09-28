// Profile, frame 5b in the 1b layout (EXEC-11 task 3): goal, program, current
// stats, and the free label and value fields kept below. Only what the user
// entered; the app computes nothing here (PLAN section 4).

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getGoals, getProfile, saveProfile } from '../db/index.ts'
import { ACTIVITY_OPTIONS, fromGoals, goalSummary, profileDraft } from '../lib/goals.ts'
import { LockIcon, SectionHead } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import { unitsOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Program } from '../types/program.ts'
import type { Goals } from '../types/stores.ts'
import { GearIcon } from '../ui/icons.tsx'
import { StateBlock } from '../ui/StateBlock.tsx'

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

function Chevron() {
  return (
    <svg className="sx-row__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
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
  const { program, week } = useProgram()
  const { settings } = useSettings()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [goals, setGoals] = useState<Goals | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    void getProfile().then((profile) => {
      if (live) setRows(rowsFrom(profile?.fields ?? {}))
    })
    void getGoals().then((found) => live && setGoals(found ?? null))
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

  return (
    <div className="tl" style={{ paddingBottom: 24 }}>
      <div className="pf-head">
        <h1 className="lg-title">Profile</h1>
        <button type="button" className="pf-gear" aria-label="Settings" onClick={() => navigate('/settings')}>
          <GearIcon />
        </button>
      </div>

      <div className="sx-body">
        {summary ? (
          <>
            <SectionHead aside="Edit">Goal</SectionHead>
            <button type="button" className="pf-goal" onClick={() => navigate('/goal')}>
              <span>{summary}</span>
              <Chevron />
            </button>
          </>
        ) : (
          <>
            <SectionHead>Goal</SectionHead>
            {/* 7e: no goal set */}
            <div className="pf-state">
              <StateBlock
                mark="+"
                title="No goal yet"
                body="A goal helps the AI review your program. It’s optional."
                primary={{ label: 'Set a goal', onClick: () => navigate('/goal') }}
              />
            </div>
          </>
        )}

        <SectionHead>Program</SectionHead>
        {program ? (
          <>
            <button type="button" className="sx-row" onClick={() => navigate('/week')}>
              <div className="sx-row__main">
                <div className="pf-program">{program.name}</div>
                <div className="sx-row__sub">
                  Week {week} of {program.programWeeks} · {programSpan(program)}
                </div>
              </div>
              <Chevron />
            </button>
            <button type="button" className="sx-row pf-action" onClick={() => navigate('/program/edit')}>
              <span className="sx-row__main">Edit program</span>
              <Chevron />
            </button>
            <button type="button" className="sx-row pf-action" onClick={() => navigate('/program/new')}>
              <span className="sx-row__main">Start a new program</span>
              <Chevron />
            </button>
          </>
        ) : (
          <div className="pf-state">
            <StateBlock
              mark="+"
              title="No program yet"
              body="Pick a starter program or build your own. It takes a few minutes."
              primary={{ label: 'Pick a starter', onClick: () => navigate('/program/new') }}
              secondary={{ label: 'Build my own', onClick: () => navigate('/program/new', { state: { build: true } }) }}
            />
          </div>
        )}

        <div className="ob-sechead">
          <span>Current stats</span>
          <span className="pf-lock">
            <LockIcon />
            Stored on this phone
          </span>
        </div>
        {statRows(goals, unit).map((stat) => (
          <button type="button" className="sx-row" key={stat.label} onClick={() => navigate('/goal')}>
            <div className="sx-row__main">
              <div className="sx-row__title">{stat.label}</div>
              <div className="sx-row__sub">{stat.privacy}</div>
            </div>
            {stat.value === null ? <span className="pf-add">Add</span> : <span className="sx-row__value">{stat.value}</span>}
          </button>
        ))}

        <SectionHead>Other details</SectionHead>
        {rows.length === 0 && (
          <p className="sx-note" style={{ borderBottom: 'none', margin: 0 }}>
            Nothing here yet. Add the fields you want the reprogramming prompt to know about — a goal, targets, anything you choose to enter.
          </p>
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
      </div>
    </div>
  )
}
