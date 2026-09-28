// Building blocks for the 1b onboarding and goal frames (1a to 1l, 5a).
// Colours come from the Phase 6 tokens; sizes follow the frames.

import type { ReactNode } from 'react'

export const TOTAL_STEPS = 8

export function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M14 6l-6 6 6 6" />
    </svg>
  )
}

export function TickIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }} aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function HandleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }} aria-hidden="true">
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="15" x2="18" y2="15" />
    </svg>
  )
}

export function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M8 10l4 4 4-4" />
    </svg>
  )
}

/** Back chevron, progress dots and Skip, as every step from 1b on shows them. */
export function StepNav({
  step,
  onBack,
  onSkip,
}: {
  /** 1-based step of 8. */
  step: number
  onBack?: () => void
  onSkip?: () => void
}) {
  return (
    <div className="ob-nav">
      <div className="ob-nav__side">
        {onBack && (
          <button type="button" aria-label="Back" onClick={onBack} style={{ display: 'flex' }}>
            <BackIcon />
          </button>
        )}
      </div>
      <div className="ob-dots" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={
              i + 1 === step ? 'ob-dot ob-dot--current' : i + 1 < step ? 'ob-dot ob-dot--done' : 'ob-dot'
            }
          />
        ))}
      </div>
      <div className="ob-nav__side ob-nav__side--end">
        {onSkip && (
          <button type="button" onClick={onSkip}>
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

export function StepHead({ step, title, lede }: { step: number; title: string; lede?: string }) {
  return (
    <div className="ob-head">
      <div className="ob-step">
        Step {step} of {TOTAL_STEPS}
      </div>
      <h1 className="ob-title">{title}</h1>
      {lede && <div className="ob-lede">{lede}</div>}
    </div>
  )
}

/** A radio (round) or checkbox (square) row from the 1b lists. */
export function ChoiceRow({
  title,
  sub,
  badge,
  on,
  shape = 'radio',
  compact,
  disabled,
  onClick,
}: {
  title: string
  sub?: string
  badge?: string
  on: boolean
  shape?: 'radio' | 'check'
  compact?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role={shape === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={on}
      className={compact ? 'ob-row ob-row--compact' : 'ob-row'}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="ob-row__main">
        <div className={on ? 'ob-row__title ob-row__title--on' : 'ob-row__title'}>
          {title}
          {badge && <span className="ob-badge">{badge}</span>}
        </div>
        {sub && <div className="ob-row__sub">{sub}</div>}
      </div>
      <span
        className={[
          'ob-mark',
          shape === 'check' ? 'ob-mark--check' : '',
          on ? 'ob-mark--on' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {on && <TickIcon />}
      </span>
    </button>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="ob-seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? 'ob-seg__opt ob-seg__opt--on' : 'ob-seg__opt'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  label,
  min = 1,
}: {
  value: number
  onChange: (value: number) => void
  label: string
  min?: number
}) {
  return (
    <div className="ob-stepper">
      <button type="button" aria-label={`Less ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <div className="ob-stepper__value" aria-live="polite" aria-label={label}>
        {value}
      </div>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

export function SectionHead({ children, aside }: { children: ReactNode; aside?: string }) {
  return (
    <div className="ob-sechead">
      <span>{children}</span>
      <span className="ob-sechead__aside">{aside}</span>
    </div>
  )
}

/** The fixed bottom area with its fade, holding one or two buttons. */
export function Dock({ children }: { children: ReactNode }) {
  return <div className="ob-dock">{children}</div>
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className="ob-primary" onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      <ArrowIcon />
    </button>
  )
}
