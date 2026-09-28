// Onboarding steps 7 (1j, 1k): the AI intro and the key and privacy level.
// Also used on their own when Review is tapped with no key (EXEC-09 task 6).

import { useState } from 'react'

import { DEFAULT_MODEL, testKey } from '../lib/anthropic.ts'
import { PRIVACY_LEVELS } from '../lib/payload.ts'
import type { PrivacyLevel } from '../types/stores.ts'
import { ChoiceRow, Dock, PrimaryButton, SectionHead, StepHead, StepNav } from './ui.tsx'

/** Frame 1j. */
export function AIIntroStep({
  step,
  onBack,
  onSetUp,
  onSkip,
}: {
  step: number
  onBack: () => void
  onSetUp: () => void
  onSkip: () => void
}) {
  return (
    <div className="ob">
      <StepNav step={step} onBack={onBack} />
      <StepHead step={step} title="Optional: AI help with your program" lede="The app works fully without this." />
      <div className="ob-pad">
        <SectionHead>What it can do</SectionHead>
        <div className="ob-bullet">Review your program against your goal</div>
        <div className="ob-bullet">Suggest next week from what you logged</div>
        <div className="ob-bullet">Estimate calories for meals the app doesn&apos;t know</div>
        <div className="ob-note" style={{ marginTop: 10 }}>
          Nothing changes until you approve it.
        </div>
        <SectionHead>What it costs</SectionHead>
        <div className="ob-para">
          You pay Anthropic directly, through your own account. You can set a spend limit there.
          BYOB-fit charges nothing.
        </div>
      </div>
      <Dock>
        <button type="button" className="ob-outline" onClick={onSetUp}>
          Set up AI
        </button>
        <button type="button" className="ob-outline" onClick={onSkip}>
          Skip, I&apos;ll do this later
        </button>
      </Dock>
    </div>
  )
}

/** Frame 1k. */
export function AIKeyStep({
  step,
  apiKey,
  onApiKey,
  privacyLevel,
  onPrivacyLevel,
  showTip,
  onBack,
  onSkip,
  onSave,
}: {
  step: number
  apiKey: string
  onApiKey: (key: string) => void
  privacyLevel: PrivacyLevel
  onPrivacyLevel: (level: PrivacyLevel) => void
  /** Users who answered New see the Standard tip (D-031). */
  showTip: boolean
  onBack: () => void
  onSkip: () => void
  onSave: () => void
}) {
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function runKeyTest() {
    setTesting(true)
    setKeyStatus(null)
    const result = await testKey(apiKey.trim(), DEFAULT_MODEL)
    setKeyStatus(result.ok ? { ok: true, text: 'Key works · tested just now' } : { ok: false, text: result.error })
    setTesting(false)
  }

  return (
    <div className="ob">
      <StepNav step={step} onBack={onBack} onSkip={onSkip} />
      <StepHead step={step} title="Set up in 3 steps" />
      <div className="ob-list" style={{ marginTop: 14 }}>
        <div className="ob-numbered">
          <span className="ob-numbered__n">1</span>
          <div className="ob-numbered__text">
            Sign in or create an account at{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
          </div>
        </div>
        <div className="ob-numbered">
          <span className="ob-numbered__n">2</span>
          <div className="ob-numbered__text">Create an API key and copy it</div>
        </div>
        <div className="ob-numbered">
          <span className="ob-numbered__n">3</span>
          <div className="ob-numbered__text">
            Paste it here
            <div className="ob-keyrow">
              <div className="ob-field ob-field--key">
                <input
                  aria-label="API key"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-ant-…"
                  value={apiKey}
                  onChange={(event) => {
                    onApiKey(event.target.value)
                    setKeyStatus(null)
                  }}
                />
              </div>
              <button
                type="button"
                className="ob-keybtn"
                disabled={testing || apiKey.trim() === ''}
                onClick={() => void runKeyTest()}
              >
                {testing ? '…' : 'Test'}
              </button>
            </div>
            {keyStatus && (
              <div className={`status status--${keyStatus.ok ? 'ok' : 'error'}`} role="status">
                {keyStatus.text}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="ob-pad">
        <div style={{ marginTop: 20 }} />
        <SectionHead>What the AI can see</SectionHead>
        <div role="radiogroup" aria-label="What the AI can see">
          {PRIVACY_LEVELS.map((level) => (
            <ChoiceRow
              key={level.value}
              compact
              title={level.title}
              sub={level.sub}
              badge={level.value === 'minimal' ? 'Default' : undefined}
              on={privacyLevel === level.value}
              onClick={() => onPrivacyLevel(level.value)}
            />
          ))}
        </div>
        {showTip && (
          <div className="ob-tip">Tip: Standard helps the AI avoid pushing exercises that caused discomfort.</div>
        )}
      </div>
      <Dock>
        <PrimaryButton onClick={onSave}>Save and continue</PrimaryButton>
      </Dock>
    </div>
  )
}
