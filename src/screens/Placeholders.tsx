import { useNavigate } from 'react-router-dom'

import { formatLongDate } from '../lib/dates.ts'
import { useProgram } from '../program/useProgram.ts'
import { ChevronLeftIcon, GearIcon } from '../ui/icons.tsx'

export function LogScreen() {
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Log</h1>
      </div>
      <p className="muted-line">Coming in Phase 3</p>
    </div>
  )
}

export function MealsScreen() {
  const { today } = useProgram()
  return (
    <div className="page">
      <div className="page-head page-head--split">
        <h1 className="page-title">Meals</h1>
        <span className="page-head__aside">{formatLongDate(today)}</span>
      </div>
      <p className="muted-line">Coming in Phase 4</p>
    </div>
  )
}

export function ProfileScreen() {
  const navigate = useNavigate()
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
      <p className="muted-line">Coming in Phase 4</p>
    </div>
  )
}

export function SettingsScreen() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <div className="sub-head">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
        </button>
        <div className="sub-head__title">Settings</div>
      </div>
      <p className="muted-line">Coming in Phase 4</p>
    </div>
  )
}
