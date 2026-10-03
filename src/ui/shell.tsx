// Design v3 building blocks (D-083): the fixed header with the wordmark, the
// segmented control, the progress ring and grouped list rows. Values are
// from design/BYOB-fit_v3_design.html; colours come from tokens only.

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/** The BYOB-fit wordmark: the O drawn as a weight plate (placeholder logo). */
export function Wordmark() {
  return (
    <span className="wordmark" aria-label="BYOB-fit" role="img">
      <span className="wordmark__type">BY</span>
      <span className="wordmark__plate" aria-hidden="true">
        <span />
      </span>
      <span className="wordmark__type">B</span>
      <span className="wordmark__fit">-fit</span>
    </span>
  )
}

export function BackChevron() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
      <path d="M7 2L2 7l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RowChevron() {
  return (
    <svg className="row-chevron" width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
      <path d="M3 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The fixed header on every app screen: a brand row (context text on the
 * left, the wordmark centred), then a context row with a title or a control
 * and a right-hand action. Content scrolls underneath it.
 */
export function AppHeader({
  context,
  title,
  aside,
  action,
  back,
  children,
}: {
  /** Brand-row text on the left, e.g. "Thu · week 6". */
  context?: ReactNode
  title?: ReactNode
  /** Small text after the title, e.g. "2 of 7". */
  aside?: ReactNode
  action?: ReactNode
  /** A back link in place of the title row's title. */
  back?: { label: string; to?: string; onClick?: () => void }
  /** A control in place of the title row (the Today and Week switch). */
  children?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="hdr">
      <div className="hdr__brand">
        <span className="hdr__context">{context}</span>
        <span className="hdr__mark">
          <Wordmark />
        </span>
      </div>
      {children ? (
        <div className="hdr__control">{children}</div>
      ) : (
        <div className={back ? 'hdr__row hdr__row--back' : 'hdr__row'}>
          {back ? (
            <button
              type="button"
              className="hdr__back"
              onClick={back.onClick ?? (() => (back.to ? navigate(back.to) : navigate(-1)))}
            >
              <BackChevron />
              {back.label}
            </button>
          ) : (
            <div className="hdr__titles">
              {title !== undefined && <h1 className="hdr__title">{title}</h1>}
              {aside !== undefined && <span className="hdr__aside">{aside}</span>}
            </div>
          )}
          {action && <div className="hdr__action">{action}</div>}
        </div>
      )}
    </header>
  )
}

/** A two- or three-way switch: the selected option is a raised pill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? 'seg__option seg__option--on' : 'seg__option'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** The Today and Week switch at the top of Train (D-077 rule 1). */
export function TrainSwitch({ view }: { view: 'today' | 'week' }) {
  const navigate = useNavigate()
  return (
    <Segmented
      label="Train"
      value={view}
      options={[
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'Week' },
      ]}
      onChange={(next) => navigate(next === 'today' ? '/' : '/week')}
    />
  )
}

const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

/** A ring that fills clockwise from the top; `value` is 0 to 1. */
export function ProgressRing({
  value,
  size = 118,
  stroke = 10,
  children,
  label,
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
  label?: string
}) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ring__track" cx="60" cy="60" r={RING_R} fill="none" strokeWidth={stroke} />
        <circle
          className="ring__fill"
          cx="60"
          cy="60"
          r={RING_R}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={RING_C.toFixed(1)}
          strokeDashoffset={(RING_C * (1 - clamped)).toFixed(1)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      {children && <div className="ring__centre">{children}</div>}
    </div>
  )
}

/** A labelled group of rows on a sheet-coloured card. */
export function ListGroup({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="lgroup">
      {(title || aside) && (
        <div className="lgroup__head">
          {title && <h2 className="lgroup__title">{title}</h2>}
          {aside}
        </div>
      )}
      <div className="lgroup__card">{children}</div>
    </section>
  )
}

/** One row: a title with an optional line under it, a value and a chevron. */
export function ListRow({
  title,
  sub,
  value,
  onClick,
  chevron = Boolean(onClick),
  danger,
}: {
  title: ReactNode
  sub?: ReactNode
  value?: ReactNode
  onClick?: () => void
  chevron?: boolean
  danger?: boolean
}) {
  const inner = (
    <>
      <span className="lrow__text">
        <span className={danger ? 'lrow__title lrow__title--danger' : 'lrow__title'}>{title}</span>
        {sub && <span className="lrow__sub">{sub}</span>}
      </span>
      {value !== undefined && <span className="lrow__value">{value}</span>}
      {chevron && <RowChevron />}
    </>
  )
  return onClick ? (
    <button type="button" className="lrow" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="lrow">{inner}</div>
  )
}

/** A centred empty state with one optional primary action. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: ReactNode
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="empty-v3">
      <h2 className="empty-v3__title">{title}</h2>
      {body && <p className="empty-v3__body">{body}</p>}
      {action && (
        <button type="button" className="btn btn--primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

export function Tick({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 7.5l2.5 2.5L11 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export type RowState = 'todo' | 'done' | 'now'

/** The circle beside each item: empty, done (filled with a tick) or now (a dot). */
export function Marker({ state }: { state: RowState }) {
  return (
    <span className={`marker marker--${state}`} aria-hidden="true">
      {state === 'done' && <Tick />}
      {state === 'now' && <span className="marker__dot" />}
    </span>
  )
}

