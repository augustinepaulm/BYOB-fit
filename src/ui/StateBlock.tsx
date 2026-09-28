// Empty, loading and error states, frames 7a to 7e (EXEC-11 task 9): a round
// mark, a title, one line, and up to two buttons.

import type { ReactNode } from 'react'

export interface StateAction {
  label: string
  onClick: () => void
}

export function StateBlock({
  mark,
  title,
  body,
  primary,
  secondary,
  role,
}: {
  /** '+', '–', '!', '?', '↓', '↺', or 'loading' for the spinner. */
  mark: string
  title: string
  body?: ReactNode
  primary?: StateAction
  secondary?: StateAction
  role?: 'status' | 'alert'
}) {
  return (
    <div className="st-block" role={role}>
      <div className="st-block__mark" aria-hidden="true">
        {mark === 'loading' ? <span className="st-block__spinner" /> : mark}
      </div>
      <div className="st-block__main">
        <div className="st-block__title">{title}</div>
        {body && <div className="st-block__body">{body}</div>}
        {(primary || secondary) && (
          <div className="st-block__actions">
            {primary && (
              <button type="button" className="st-btn st-btn--primary" onClick={primary.onClick}>
                {primary.label}
              </button>
            )}
            {secondary && (
              <button type="button" className="st-btn" onClick={secondary.onClick}>
                {secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Frame 7e "Import error", with the checker's findings under it. */
export function ImportErrorState({ errors, onChoose }: { errors: string[]; onChoose: () => void }) {
  return (
    <div className="lg-state st-import">
      <StateBlock
        role="alert"
        mark="!"
        title="This file isn’t a BYOB-fit program"
        body="Nothing was changed. Try another file."
        primary={{ label: 'Choose another file', onClick: onChoose }}
      />
      {errors.length > 0 && (
        <ul className="st-import__list">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
