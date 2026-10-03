export function Dialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  /** The dismissing action's label; it does what the scrim does. */
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="dialog-scrim" onClick={onCancel} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog__title">{title}</div>
        <div className="dialog__body">{body}</div>
        {/* Frame 2.11: stacked buttons. A destructive confirm sits under the
            primary way out; otherwise the confirm is primary and Cancel is text. */}
        <div className="dialog__actions">
          {danger ? (
            <>
              <button type="button" className="btn btn--primary" onClick={onCancel}>
                {cancelLabel}
              </button>
              <button type="button" className="btn btn--destructive is-danger" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--primary" onClick={onConfirm}>
                {confirmLabel}
              </button>
              <button type="button" className="btn btn--tertiary" onClick={onCancel}>
                {cancelLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
