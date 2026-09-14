import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { clearAllStores } from '../db/index.ts'
import { DEFAULT_MODEL, testKey } from '../lib/anthropic.ts'
import {
  buildBackup,
  deliverBackup,
  restoreBackup,
  validateBackup,
} from '../lib/backup.ts'
import { useProgram } from '../program/useProgram.ts'
import { useSettings } from '../settings/useSettings.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { CheckIcon, ChevronLeftIcon } from '../ui/icons.tsx'

type Status = { kind: 'ok' | 'error'; text: string } | null

export function SettingsScreen() {
  const navigate = useNavigate()
  const { refresh } = useProgram()
  const { settings, loading, update } = useSettings()
  const [keyDraft, setKeyDraft] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testStatus, setTestStatus] = useState<Status>(null)
  const [dataStatus, setDataStatus] = useState<Status>(null)
  const [confirm, setConfirm] = useState<'reset' | 'import' | null>(null)
  const [pendingImport, setPendingImport] = useState<string | null>(null)

  if (loading) return null

  const model = settings.model ?? DEFAULT_MODEL

  async function runTest() {
    setTesting(true)
    setTestStatus(null)
    const result = await testKey(keyDraft ?? settings.apiKey ?? '', model)
    setTestStatus(
      result.ok
        ? { kind: 'ok', text: 'Key works · tested just now' }
        : { kind: 'error', text: result.error },
    )
    setTesting(false)
  }

  async function exportData() {
    setDataStatus(null)
    try {
      const backup = await buildBackup()
      const how = await deliverBackup(backup)
      if (how === 'cancelled') return
      await update({ lastExportAt: new Date().toISOString() })
      setDataStatus({
        kind: 'ok',
        text: how === 'shared' ? 'Export shared.' : 'Export downloaded.',
      })
    } catch (error) {
      setDataStatus({ kind: 'error', text: (error as Error).message })
    }
  }

  async function onDataFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setDataStatus(null)
    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      setDataStatus({
        kind: 'error',
        text: `That file is not valid JSON (${(error as Error).message}).`,
      })
      return
    }
    const result = validateBackup(parsed)
    if (!result.ok) {
      setDataStatus({ kind: 'error', text: result.errors.join(' · ') })
      return
    }
    setPendingImport(text)
    setConfirm('import')
  }

  async function doImport() {
    setConfirm(null)
    if (!pendingImport) return
    const result = validateBackup(JSON.parse(pendingImport))
    setPendingImport(null)
    if (!result.ok) return
    await restoreBackup(result.backup)
    await refresh()
    setDataStatus({ kind: 'ok', text: 'Data replaced from the export.' })
  }

  async function doReset() {
    setConfirm(null)
    await clearAllStores()
    await refresh()
    navigate('/import', { replace: true })
  }

  return (
    <div className="page">
      <div className="sub-head">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
        </button>
        <div className="sub-head__title">Settings</div>
      </div>

      <div className="section-label">Model</div>
      <div className="form-card">
        <label className="field-label" htmlFor="api-key">
          API key
        </label>
        <div className="input-row">
          <input
            id="api-key"
            className="text-input text-input--mono"
            type="password"
            autoComplete="off"
            placeholder={settings.apiKey ? '••••••••••••' : 'sk-ant-…'}
            value={keyDraft ?? ''}
            onChange={(event) => setKeyDraft(event.target.value)}
            onBlur={() => {
              if (keyDraft !== null && keyDraft !== '') {
                void update({ apiKey: keyDraft })
              }
            }}
          />
          <button
            type="button"
            className="btn-inline"
            disabled={testing}
            onClick={() => void runTest()}
          >
            {testing ? '…' : 'Test'}
          </button>
        </div>
        {testStatus && (
          <div
            className={`status status--${testStatus.kind === 'ok' ? 'ok' : 'error'}`}
            role="status"
          >
            {testStatus.kind === 'ok' && <CheckIcon size={14} />}
            <span>{testStatus.text}</span>
          </div>
        )}

        <label className="field-label" htmlFor="model">
          Model name
        </label>
        <input
          id="model"
          className="text-input text-input--mono"
          type="text"
          value={model}
          onChange={(event) => void update({ model: event.target.value })}
        />
      </div>

      <div className="section-label">Rules and baseline</div>
      <div className="form-card">
        <label className="field-label" htmlFor="rules">
          Reprogramming rules
        </label>
        <textarea
          id="rules"
          className="textarea"
          placeholder="Plain text rules the model must follow when it writes next week."
          defaultValue={settings.rules ?? ''}
          onBlur={(event) => void update({ rules: event.target.value })}
        />
        <label className="field-label" htmlFor="baseline">
          Meal baseline
        </label>
        <textarea
          id="baseline"
          className="textarea"
          placeholder="What DFS means: your default full day of food."
          defaultValue={settings.mealBaseline ?? ''}
          onBlur={(event) => void update({ mealBaseline: event.target.value })}
        />
      </div>

      <div className="section-label">Data</div>
      <div className="card--rows">
        <button type="button" className="setting-row" onClick={() => void exportData()}>
          <span>Export data</span>
          <span className="setting-row__hint">JSON</span>
        </button>
        <label className="setting-row" style={{ cursor: 'pointer' }}>
          <span>Import data</span>
          <span className="setting-row__hint">JSON</span>
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(event) => void onDataFile(event)}
          />
        </label>
        <button type="button" className="setting-row" onClick={() => navigate('/import')}>
          <span>Import program</span>
          <span className="setting-row__hint">JSON</span>
        </button>
        <button
          type="button"
          className="setting-row setting-row--danger"
          onClick={() => setConfirm('reset')}
        >
          <span>Reset app</span>
          <span className="setting-row__hint">asks to confirm</span>
        </button>
      </div>
      {dataStatus && (
        <div
          className={`status status--${dataStatus.kind === 'ok' ? 'ok' : 'error'}`}
          style={{ margin: '8px 20px 0' }}
          role="status"
        >
          <span>{dataStatus.text}</span>
        </div>
      )}

      <p className="muted-line" style={{ marginTop: 16, marginBottom: 24 }}>
        Your key and data stay on this phone. Once a week, your log is sent to the
        model to build next week.
      </p>

      {confirm === 'reset' && (
        <Dialog
          title="Reset app?"
          body="This clears the program, every session, meals, profile and settings on this device. Export first if you want a copy."
          confirmLabel="Reset"
          danger
          onConfirm={() => void doReset()}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'import' && (
        <Dialog
          title="Replace all data?"
          body="Importing replaces the program, sessions, meals, profile and settings on this device with the contents of the file."
          confirmLabel="Replace"
          danger
          onConfirm={() => void doImport()}
          onCancel={() => {
            setConfirm(null)
            setPendingImport(null)
          }}
        />
      )}
    </div>
  )
}
