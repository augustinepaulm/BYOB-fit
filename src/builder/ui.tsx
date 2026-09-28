// Building blocks for the 1b builder frames (2a to 2j).

import type { ReactNode } from 'react'

import { BackIcon, TickIcon } from '../onboarding/ui.tsx'

export function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }} aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** The two-way arrows used for Swap (2b) and for swappable days (2f). */
export function SwapArrows() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }} aria-hidden="true">
      <path d="M7 8h10M14 4.5L17.5 8 14 11.5M17 16H7M10 12.5L6.5 16l3.5 3.5" />
    </svg>
  )
}

export function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <line x1="15.5" y1="15.5" x2="20" y2="20" />
    </svg>
  )
}

/** Back chevron, title, optional Draft badge and a right-hand action. */
export function BuilderBar({
  title,
  draft,
  onBack,
  right,
}: {
  title: string
  draft?: boolean
  onBack: () => void
  right?: ReactNode
}) {
  return (
    <div className="ob-appbar">
      <button type="button" className="ob-appbar__back" aria-label="Back" onClick={onBack}>
        <BackIcon />
      </button>
      <div className="bd-title">
        <span>{title}</span>
        {draft && <span className="bd-draft">Draft</span>}
      </div>
      <div style={{ minWidth: 44, textAlign: 'right' }}>{right}</div>
    </div>
  )
}

export function AppbarAction({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className="ob-appbar__save" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

const STEPS = ['Settings', 'Days', 'Exercises', 'Review']

/** Frames 2e to 2j: bars fill up to the current step; its label is bold. */
export function StepBar({ current }: { current: number }) {
  return (
    <div className="bd-steps" aria-label={`Step ${current + 1} of 4: ${STEPS[current]}`}>
      {STEPS.map((label, i) => (
        <div className="bd-step" key={label}>
          <div className={i <= current ? 'bd-step__bar bd-step__bar--on' : 'bd-step__bar'} />
          <div className={i === current ? 'bd-step__label bd-step__label--current' : 'bd-step__label'}>
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Hero({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="bd-hero">
      <h1 className="bd-hero__title">{title}</h1>
      {sub && <div className="bd-hero__sub">{sub}</div>}
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="bd-note">{children}</div>
}

/** Demo slot placeholder until bundled demos exist (D-033, O-6). */
export function Demo({ large }: { large?: boolean }) {
  return (
    <div className={large ? 'bd-demo bd-demo--lg' : 'bd-demo'} aria-hidden="true">
      <span>demo</span>
    </div>
  )
}

export function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={on ? 'bd-chip bd-chip--on' : 'bd-chip'}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (on: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={on ? 'bd-switch bd-switch--on' : 'bd-switch'}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  )
}

/** Bottom sheet over a scrim (2i and the discard confirmation). */
export function Sheet({
  title,
  body,
  children,
  onClose,
}: {
  title: string
  body: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <>
      <div className="bd-scrim" onClick={onClose} />
      <div className="bd-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="bd-sheet__grab" />
        <h2 className="bd-sheet__title">{title}</h2>
        <div className="bd-sheet__body">{body}</div>
        <div className="bd-sheet__actions">{children}</div>
      </div>
    </>
  )
}

export function CheckMark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="bd-check__mark" aria-label="Passes">
      <TickIcon />
    </span>
  ) : (
    <span className="bd-check__mark bd-check__mark--fail" aria-label="Fails">
      ×
    </span>
  )
}
