import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getGoals, getProfile, saveProfile } from '../db/index.ts'
import { fromGoals, goalSummary } from '../lib/goals.ts'
import { useProgram } from '../program/useProgram.ts'
import { GearIcon } from '../ui/icons.tsx'

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

/** Only what the user typed; the app computes nothing here (PLAN section 4). */
export function ProfileScreen() {
  const navigate = useNavigate()
  const { program, week } = useProgram()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [goal, setGoal] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void getProfile().then((profile) => {
      if (live) setRows(rowsFrom(profile?.fields ?? {}))
    })
    return () => {
      live = false
    }
  }, [])

  // The Goal row (EXEC-07 task 6) reads its summary from the goals store.
  useEffect(() => {
    let live = true
    void getGoals().then((goals) => {
      if (live && goals)
        setGoal(
          goalSummary(fromGoals(goals), goals.timeframeWeeks, (id) => program?.exercises[id]?.name),
        )
    })
    return () => {
      live = false
    }
  }, [program])

  async function persist(next: Row[]) {
    setRows(next)
    const fields: Record<string, string> = {}
    for (const row of next) {
      const label = row.label.trim()
      if (label !== '') fields[label] = row.value
    }
    await saveProfile({ fields, updatedAt: new Date().toISOString() })
  }

  if (rows === null) return null

  return (
    <div className="page">
      <div className="page-head page-head--split">
        <h1 className="page-title">Profile</h1>
        <button
          type="button"
          aria-label="Settings"
          style={{ color: 'var(--muted)' }}
          onClick={() => navigate('/settings')}
        >
          <GearIcon />
        </button>
      </div>

      <div className="card--rows" style={{ marginBottom: 14 }}>
        <button type="button" className="setting-row" onClick={() => navigate('/goal')}>
          <span>Goal</span>
          <span
            className="setting-row__hint"
            style={{ flex: '0 1 auto', minWidth: 0, textAlign: 'right' }}
          >
            {goal ?? 'Set a goal'}
          </span>
        </button>
        {program && (
          <>
            <div className="setting-row" style={{ cursor: 'default' }}>
              <span>Program</span>
              <span
                className="setting-row__hint"
                style={{ flex: '0 1 auto', minWidth: 0, textAlign: 'right' }}
              >
                {program.name} · Week {week} of {program.programWeeks}
              </span>
            </div>
            <button type="button" className="setting-row" onClick={() => navigate('/program/edit')}>
              <span>Edit program</span>
            </button>
            <button type="button" className="setting-row" onClick={() => navigate('/program/new')}>
              <span>Start a new program</span>
            </button>
          </>
        )}
      </div>

      {rows.length === 0 && (
        <p className="muted-line" style={{ marginBottom: 10 }}>
          Nothing here yet. Add the fields you want the reprogramming prompt to
          know about — a goal, targets, anything you choose to enter.
        </p>
      )}

      <div className="card--rows">
        {rows.map((row, i) => (
          <div className="profile-row" key={row.key}>
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
        <button
          type="button"
          className="add-row"
          onClick={() =>
            setRows([...rows, { key: `r${nextKey++}`, label: '', value: '' }])
          }
        >
          <span style={{ fontSize: 18, fontWeight: 400 }}>+</span>
          Add field
        </button>
      </div>
      <div style={{ height: 24 }} />
    </div>
  )
}
