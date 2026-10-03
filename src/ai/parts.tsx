// Shared pieces of the AI screens: state panels (4d, 4g), the offline bar,
// the review banner (4a, 4b) and the AI setup flow for a missing key.

import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { getGoals } from '../db/index.ts'
import { AIIntroStep, AIKeyStep } from '../onboarding/AISteps.tsx'
import { privacyLevelOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Program } from '../types/program.ts'
import type { PrivacyLevel, Settings } from '../types/stores.ts'

export function StatePanel({
  icon,
  title,
  body,
  errors,
  children,
}: {
  icon: 'spin' | '!' | '?' | '✓'
  title: string
  body?: string
  errors?: string[]
  children?: ReactNode
}) {
  return (
    <div className="ai-state" role={icon === 'spin' ? 'status' : undefined}>
      <div className="ai-state__icon">{icon === 'spin' ? <div className="ai-spin" /> : icon}</div>
      <div className="ai-state__title">{title}</div>
      {body && <div className="ai-state__body">{body}</div>}
      {errors && errors.length > 0 && (
        <ul className="ai-state__list">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {children && <div className="ai-banner__actions" style={{ marginTop: 14 }}>{children}</div>}
    </div>
  )
}

export function OfflineBar() {
  return (
    <div className="ai-offline" role="status">
      <span>You're offline. Everything works except AI.</span>
    </div>
  )
}

/**
 * Frames 4a and 4b: shown once a program and a goal both exist, until the
 * user dismisses it for this program (D-026).
 */
export function ReviewBanner({ program }: { program: Program }) {
  const navigate = useNavigate()
  const { settings, loading, update } = useSettings()
  const [hasGoal, setHasGoal] = useState(false)
  useEffect(() => {
    let live = true
    void getGoals().then((goals) => live && setHasGoal(Boolean(goals?.items.length)))
    return () => {
      live = false
    }
  }, [])
  if (loading || !hasGoal) return null
  const dismissed = settings.reviewBannerDismissedFor ?? []
  if (dismissed.includes(program.id)) return null
  return (
    <div className="ai-banner">
      <div className="ai-banner__text">Want an AI review of your program against your goal?</div>
      <div className="ai-banner__actions">
        <button type="button" className="ai-btn ai-btn--primary" onClick={() => navigate('/review')}>
          Review
        </button>
        <button type="button" className="ai-btn" onClick={() => void update({ reviewBannerDismissedFor: [...dismissed, program.id] })}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

/**
 * Onboarding steps 1j and 1k on their own, for Review or Ask AI with no key.
 * Saves the key and level, then hands back.
 */
export function AISetupFlow({
  settings,
  onSaved,
  onCancel,
}: {
  settings: Settings
  onSaved: (patch: { apiKey: string; privacyLevel: PrivacyLevel }) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<'intro' | 'key'>('intro')
  const [apiKey, setApiKey] = useState('')
  const [level, setLevel] = useState<PrivacyLevel>(privacyLevelOf(settings))
  if (step === 'intro') {
    return <AIIntroStep step={7} onBack={onCancel} onSetUp={() => setStep('key')} onSkip={onCancel} />
  }
  return (
    <AIKeyStep
      step={7}
      apiKey={apiKey}
      onApiKey={setApiKey}
      privacyLevel={level}
      onPrivacyLevel={setLevel}
      showTip={settings.onboarding?.experience === 'new'}
      onBack={() => setStep('intro')}
      onSkip={onCancel}
      onSave={() => (apiKey.trim() ? onSaved({ apiKey: apiKey.trim(), privacyLevel: level }) : onCancel())}
    />
  )
}
