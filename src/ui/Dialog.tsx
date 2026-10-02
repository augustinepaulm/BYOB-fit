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
        <div className="dialog__actions">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'is-danger' : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
