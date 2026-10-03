// The send preview as a hook: every AI screen opens it before a call, and
// its Change link swaps in the privacy level screen (5e) until a level is
// chosen. The payload is rebuilt from the same function for every change.

import { useEffect, useState, type ReactNode } from 'react'

import { listSentLog } from '../db/index.ts'
import type { CallKind, Payload } from '../lib/payload.ts'
import { gateFor, type BudgetGate } from '../lib/usage.ts'
import { privacyLevelOf } from '../settings/defaults.ts'
import type { PrivacyLevel, Settings } from '../types/stores.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { PrivacyLevelPicker, SendPreview } from './Privacy.tsx'

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export interface PreviewControl {
  /** The sheet, or the privacy screen while a level is being chosen. */
  element: ReactNode
  /** The privacy screen is full-screen; render only it while true. */
  picking: boolean
  /** Checks the budget first (D-085 rule 4), then opens the preview or says why not. */
  open: () => void
}

export function usePreview({
  kind,
  settings,
  build,
  onLevel,
  onSend,
  onCancel,
}: {
  kind: CallKind
  settings: Settings
  build: (level: PrivacyLevel, includeNotes: boolean) => Payload
  onLevel: (level: PrivacyLevel) => void
  onSend: (payload: Payload, level: PrivacyLevel) => void
  onCancel?: () => void
}): PreviewControl {
  const [showing, setShowing] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [picking, setPicking] = useState(false)
  const [gate, setGate] = useState<BudgetGate>({ kind: 'ok' })
  const online = useOnline()
  const level = privacyLevelOf(settings)

  let element: ReactNode = null
  if (gate.kind === 'block') {
    // Over budget with Stop on: nothing is sent and no preview opens.
    element = (
      <Dialog
        title={gate.title}
        body={gate.text}
        confirmLabel="OK"
        cancelLabel="Close"
        onConfirm={() => {
          setGate({ kind: 'ok' })
          onCancel?.()
        }}
        onCancel={() => {
          setGate({ kind: 'ok' })
          onCancel?.()
        }}
      />
    )
  } else if (picking) {
    element = (
      <PrivacyLevelPicker
        value={level}
        onBack={() => setPicking(false)}
        onChange={(next) => {
          onLevel(next)
          setPicking(false)
        }}
      />
    )
  } else if (showing) {
    const payload = build(level, includeNotes)
    element = (
      <SendPreview
        kind={kind}
        level={level}
        includeNotes={includeNotes}
        onIncludeNotes={setIncludeNotes}
        payload={payload}
        offline={!online}
        notice={gate.kind === 'notice' ? gate.text : undefined}
        onChangeLevel={() => setPicking(true)}
        onCancel={() => {
          setShowing(false)
          onCancel?.()
        }}
        onSend={() => {
          setShowing(false)
          onSend(payload, level)
        }}
      />
    )
  }

  return {
    element,
    picking,
    open: () => {
      void listSentLog().then(
        (log) => {
          const next = gateFor(log, settings, new Date())
          setGate(next)
          if (next.kind === 'block') return
          setIncludeNotes(false)
          setShowing(true)
        },
        () => {
          // The sent log could not be read: open the preview without a budget note.
          setIncludeNotes(false)
          setShowing(true)
        },
      )
    },
  }
}
