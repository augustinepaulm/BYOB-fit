// Settings > About: the privacy page (5i) and the safety notice (5j),
// EXEC-11 task 5, D-029 and D-050 rule 4.

import { useNavigate } from 'react-router-dom'

import { BuilderBar } from '../builder/ui.tsx'
import { SAFETY_TITLE, SafetyNotice } from '../onboarding/safety.tsx'
import { SectionHead } from '../onboarding/ui.tsx'

/** Anthropic's terms for API use under the user's own key. */
export const ANTHROPIC_TERMS_URL = 'https://www.anthropic.com/legal/commercial-terms'

export function PrivacyPageScreen() {
  const navigate = useNavigate()
  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar title="Settings" onBack={() => navigate('/settings')} />
      <div className="st-hero">
        <h1 className="st-hero__title">Privacy</h1>
      </div>
      <div className="st-prose">
        <SectionHead>What is stored, and where</SectionHead>
        <p>Your program, logs, meals, goal and API key are stored on this phone only. There is no account and no server.</p>
        <SectionHead>What is sent, and when</SectionHead>
        <p>Only when you tap Send, and only what the preview shows. The Sent log lists every call.</p>
        <SectionHead>Who receives it</SectionHead>
        <p>
          The app’s maintainer receives nothing. What you send goes to Anthropic under your own account and is handled under{' '}
          <a href={ANTHROPIC_TERMS_URL} target="_blank" rel="noreferrer">
            Anthropic’s terms
          </a>
          .
        </p>
        <SectionHead>Export or delete</SectionHead>
        <p>Settings → Export data saves a copy. Settings → Reset app deletes everything on this phone.</p>
      </div>
    </div>
  )
}

/** Frame 5j: the onboarding step 3 wording, with no button. */
export function SafetyScreen() {
  const navigate = useNavigate()
  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar title="Settings" onBack={() => navigate('/settings')} />
      <div className="ob-head" style={{ paddingTop: 10 }}>
        <h1 className="ob-title" style={{ marginTop: 0 }}>
          {SAFETY_TITLE}
        </h1>
        <SafetyNotice />
      </div>
    </div>
  )
}
