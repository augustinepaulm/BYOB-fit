// Settings, frames 5c, 5d, 5f and 5g in the 1b layout (EXEC-11 task 4). Every
// control from before is kept; Appearance sits under Units (D-039).

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import pkg from '../../package.json'
import { Sheet, Switch } from '../builder/ui.tsx'
import { clearAllStores, listSentLog } from '../db/index.ts'
import { DEFAULT_MODEL, testKey } from '../lib/anthropic.ts'
import { buildBackup, deliverBackup, parseBackup, restoreBackup } from '../lib/backup.ts'
import { LEVEL_LABEL } from '../lib/payload.ts'
import { recordStoragePersistence } from '../lib/storage.ts'
import { BackIcon, Segmented, SectionHead } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import { applyAppearance } from '../settings/appearance.ts'
import { appearanceOf, privacyLevelOf, unitsOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import { CheckIcon } from '../ui/icons.tsx'
import { StateBlock } from '../ui/StateBlock.tsx'

type Status = { kind: 'ok' | 'error'; text: string } | null
type Overlay = 'export' | 'reset' | 'import' | null

export const KEY_HELP_URL = 'https://console.anthropic.com/settings/keys'
const APP_VERSION: string = pkg.version

function Chevron() {
  return (
    <svg className="sx-row__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** One settings row: title, optional line under it, value or control on the right. */
function Row({
  title,
  sub,
  value,
  onClick,
  danger,
  children,
}: {
  title: string
  sub?: string
  value?: ReactNode
  onClick?: () => void
  danger?: boolean
  children?: ReactNode
}) {
  const body = (
    <>
      <div className="sx-row__main">
        <div className={danger ? 'sx-row__title sx-row__title--danger' : 'sx-row__title'}>{title}</div>
        {sub && <div className="sx-row__sub">{sub}</div>}
      </div>
      {value !== undefined && <span className="sx-row__value">{value}</span>}
      {children}
      {onClick && !danger && <Chevron />}
    </>
  )
  return onClick ? (
    <button type="button" className="sx-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="sx-row">{body}</div>
  )
}

function monthCount(dates: string[], now: Date): number {
  return dates.filter((at) => {
    const d = new Date(at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
}

export function SettingsScreen() {
  const navigate = useNavigate()
  const { refresh } = useProgram()
  const { settings, loading, update, reload } = useSettings()
  const [keyDraft, setKeyDraft] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testStatus, setTestStatus] = useState<Status>(null)
  const [dataStatus, setDataStatus] = useState<Status>(null)
  // Today's backup note links straight to the export sheet (D-050 rule 2).
  const exportFirst = (useLocation().state as { export?: boolean } | null)?.export === true
  const [overlay, setOverlay] = useState<Overlay>(exportFirst ? 'export' : null)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [sentThisMonth, setSentThisMonth] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    void listSentLog().then((entries) => live && setSentThisMonth(monthCount(entries.map((e) => e.at), new Date())))
    return () => {
      live = false
    }
  }, [])

  if (loading) return null

  const model = settings.model ?? DEFAULT_MODEL
  const foods = settings.mealFoods ?? []

  async function runTest() {
    setTesting(true)
    setTestStatus(null)
    const result = await testKey(keyDraft || settings.apiKey || '', model)
    setTestStatus(result.ok ? { kind: 'ok', text: 'Key works · tested just now' } : { kind: 'error', text: result.error })
    setTesting(false)
  }

  async function exportData() {
    setOverlay(null)
    setDataStatus(null)
    try {
      const backup = await buildBackup()
      const how = await deliverBackup(backup)
      if (how === 'cancelled') return
      await update({ lastExportAt: new Date().toISOString() })
      setDataStatus({ kind: 'ok', text: how === 'shared' ? 'Export shared.' : 'Export downloaded.' })
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
    // The envelope and schemaVersion are checked before any store is touched.
    const result = parseBackup(text)
    if (!result.ok) {
      setDataStatus({ kind: 'error', text: result.errors.join(' · ') })
      return
    }
    setPendingImport(text)
    setOverlay('import')
  }

  async function doImport() {
    setOverlay(null)
    if (!pendingImport) return
    const result = parseBackup(pendingImport)
    setPendingImport(null)
    if (!result.ok) return
    await restoreBackup(result.backup)
    // The restored appearance applies now, not at the next load (EXEC-11 task 4).
    applyAppearance(appearanceOf(result.backup.settings))
    await recordStoragePersistence()
    await reload()
    await refresh()
    setDataStatus({ kind: 'ok', text: 'Data replaced from the export.' })
  }

  async function doReset() {
    setOverlay(null)
    await clearAllStores()
    applyAppearance('system')
    await refresh()
    navigate('/import', { replace: true })
  }

  return (
    <div className="ob sx" style={{ paddingBottom: 40 }}>
      <div className="ob-appbar">
        <button type="button" className="ob-appbar__back" aria-label="Back" onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <div className="bd-title">
          <span>Profile</span>
        </div>
        <div style={{ minWidth: 44 }} />
      </div>
      <div className="st-hero" style={{ paddingTop: 0 }}>
        <h1 className="st-hero__title">Settings</h1>
      </div>

      <div className="sx-body">
        <SectionHead>General</SectionHead>
        <div className="sx-row sx-row--control">
          <div className="sx-row__main">
            <div className="sx-row__title" id="units-label">
              Units
            </div>
          </div>
          <Segmented
            label="Units"
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
            value={unitsOf(settings)}
            // D-040: the setting only; no program, item or logged set changes.
            onChange={(units) => void update({ units })}
          />
        </div>
        <div className="sx-note">Applies to new programs and goals. Your current program keeps its units.</div>
        <div className="sx-row sx-row--stack">
          <div className="sx-row__title" id="appearance-label">
            Appearance
          </div>
          <Segmented
            label="Appearance"
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={appearanceOf(settings)}
            onChange={(appearance) => {
              applyAppearance(appearance)
              void update({ appearance })
            }}
          />
        </div>

        <SectionHead>AI</SectionHead>
        <div className="sx-key">
          <label className="sx-label" htmlFor="api-key">
            API key
          </label>
          <div className="sx-key__row">
            <div className="bd-input sx-key__input">
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                placeholder={settings.apiKey ? `••••••••${settings.apiKey.slice(-4)}` : 'sk-ant-…'}
                value={keyDraft ?? ''}
                onChange={(event) => setKeyDraft(event.target.value)}
                onBlur={() => {
                  if (keyDraft !== null && keyDraft !== '') void update({ apiKey: keyDraft })
                }}
              />
            </div>
            <button type="button" className="st-btn" disabled={testing} onClick={() => void runTest()}>
              {testing ? '…' : 'Test'}
            </button>
          </div>
          {testStatus?.kind === 'ok' && (
            <div className="sx-ok" role="status">
              <CheckIcon size={14} />
              <span>{testStatus.text}</span>
            </div>
          )}
          {testStatus?.kind === 'error' && (
            <div className="sx-inline-state">
              <StateBlock
                role="alert"
                mark="!"
                title="That key didn’t work"
                body={
                  <>
                    Check it was copied in full, then test again.
                    <span className="sx-detail">{testStatus.text}</span>
                  </>
                }
                primary={{ label: 'Test again', onClick: () => void runTest() }}
                secondary={{ label: 'How to get a key', onClick: () => window.open(KEY_HELP_URL, '_blank', 'noreferrer') }}
              />
            </div>
          )}
          <div className="sx-tip">Tip: set a spend limit in your Anthropic account.</div>
          {testStatus?.kind !== 'error' && (
            <a className="sx-link" href={KEY_HELP_URL} target="_blank" rel="noreferrer">
              How to get a key
            </a>
          )}
        </div>
        <div className="sx-row">
          <div className="sx-row__main">
            <label className="sx-row__title" htmlFor="model">
              Model name
            </label>
          </div>
          <input
            id="model"
            className="sx-model"
            type="text"
            spellCheck={false}
            autoCapitalize="off"
            value={model}
            onChange={(event) => void update({ model: event.target.value })}
          />
        </div>
        <Row title="Privacy level" value={LEVEL_LABEL[privacyLevelOf(settings)]} onClick={() => navigate('/settings/privacy')} />
        <Row title="Sent log" value={sentThisMonth === null ? '' : `${sentThisMonth} this month`} onClick={() => navigate('/settings/sent-log')} />
        <div className="sx-field">
          <label className="sx-label" htmlFor="rules">
            Reprogramming rules
          </label>
          <div className="bd-input">
            <textarea
              id="rules"
              placeholder="Plain text rules the model must follow when it writes next week."
              defaultValue={settings.rules ?? ''}
              onBlur={(event) => void update({ rules: event.target.value })}
            />
          </div>
        </div>

        <SectionHead>Meals</SectionHead>
        <Row title="Baseline foods" value={`${foods.length} ${foods.length === 1 ? 'food' : 'foods'}`} onClick={() => navigate('/settings/foods')} />
        <div className="sx-field">
          <label className="sx-label" htmlFor="baseline">
            Notes sent with lines that need AI
          </label>
          <div className="bd-input">
            <textarea
              id="baseline"
              placeholder="Context for the model, like portions or how you usually cook."
              defaultValue={settings.mealBaseline ?? ''}
              onBlur={(event) => void update({ mealBaseline: event.target.value })}
            />
          </div>
        </div>

        <SectionHead>Your data</SectionHead>
        <Row title="Export data" sub="This file contains your health data. Keep it somewhere private." onClick={() => setOverlay('export')} />
        <div className="sx-row">
          <div className="sx-row__main">
            <div className="sx-row__title">Monthly backup reminder</div>
            <div className="sx-row__sub">A note on Today once a month. No notifications.</div>
          </div>
          <Switch label="Monthly backup reminder" on={settings.backupReminder !== false} onChange={(on) => void update({ backupReminder: on })} />
        </div>
        <label className="sx-row" style={{ cursor: 'pointer' }}>
          <div className="sx-row__main">
            <div className="sx-row__title">Import data</div>
            <div className="sx-row__sub">Replaces everything with a BYOB-fit export file</div>
          </div>
          <Chevron />
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(event) => void onDataFile(event)} />
        </label>
        <Row title="Import program" sub="A BYOB-fit .json file" onClick={() => navigate('/import')} />
        {dataStatus && (
          <div className={`status status--${dataStatus.kind === 'ok' ? 'ok' : 'error'}`} style={{ margin: '8px 0 0' }} role="status">
            <span>{dataStatus.text}</span>
          </div>
        )}
        {settings.storagePersisted !== undefined && (
          <div className="sx-note">Offline storage: {settings.storagePersisted ? 'Persistent' : 'Not guaranteed by this browser'}</div>
        )}

        <SectionHead>About</SectionHead>
        <Row title="Privacy" onClick={() => navigate('/settings/privacy-page')} />
        <Row title="Safety notice" onClick={() => navigate('/settings/safety')} />
        <Row title="Version" value={APP_VERSION} />

        <div className="sx-reset">
          <Row title="Reset app" sub="Deletes everything on this phone" danger onClick={() => setOverlay('reset')} />
        </div>
      </div>

      {overlay === 'export' && (
        <>
          <div className="bd-scrim" onClick={() => setOverlay(null)} />
          <div className="bd-sheet" role="dialog" aria-modal="true" aria-label="Export your data">
            <div className="bd-sheet__grab" />
            <h2 className="bd-sheet__title sx-sheet__title">Export your data</h2>
            <div className="sx-sheet__warn">This file contains your health data. Keep it somewhere private.</div>
            <div className="bd-sheet__body sx-sheet__body">One .json file with your program, logs, meals and goal. Your API key is not included.</div>
            <div className="ai-pair" style={{ marginTop: 22 }}>
              <button type="button" className="ob-outline" onClick={() => setOverlay(null)}>
                Cancel
              </button>
              <button type="button" className="ob-primary" style={{ justifyContent: 'center' }} onClick={() => void exportData()}>
                <span>Save file</span>
              </button>
            </div>
          </div>
        </>
      )}
      {overlay === 'reset' && (
        <Sheet
          title="Delete everything?"
          body="Your program, logs, meals, goal and API key will be removed from this phone. This can't be undone. Export first if you want a copy."
          onClose={() => setOverlay(null)}
        >
          <button type="button" className="bd-danger" onClick={() => void doReset()}>
            Delete everything
          </button>
          <button type="button" className="ob-outline" onClick={() => setOverlay('export')}>
            Export first
          </button>
          <button type="button" className="bd-link" onClick={() => setOverlay(null)}>
            Cancel
          </button>
        </Sheet>
      )}
      {overlay === 'import' && (
        <Sheet
          title="Replace all data?"
          body="Importing replaces the program, sessions, meals, profile and settings on this device with the contents of the file."
          onClose={() => {
            setOverlay(null)
            setPendingImport(null)
          }}
        >
          <button type="button" className="bd-danger" onClick={() => void doImport()}>
            Replace
          </button>
          <button
            type="button"
            className="bd-link"
            onClick={() => {
              setOverlay(null)
              setPendingImport(null)
            }}
          >
            Cancel
          </button>
        </Sheet>
      )}
    </div>
  )
}
