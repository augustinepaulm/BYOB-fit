import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { saveProgram, setActiveProgram } from '../db/index.ts'
import { importProgramText } from '../lib/importProgram.ts'
import { useProgram } from '../program/useProgram.ts'
import type { Program } from '../types/program.ts'

export function ImportScreen() {
  const { refresh } = useProgram()
  const navigate = useNavigate()
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function activate(program: Program) {
    await saveProgram(program)
    await setActiveProgram(program.id)
    await refresh()
    navigate('/', { replace: true })
  }

  async function load(text: string) {
    const result = importProgramText(text)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    await activate(result.program)
  }

  async function loadSample() {
    setBusy(true)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-program.json`)
      if (!response.ok) {
        setErrors([`/: could not fetch the sample program (HTTP ${response.status})`])
        return
      }
      await load(await response.text())
    } catch (error) {
      setErrors([`/: could not fetch the sample program (${(error as Error).message})`])
    } finally {
      setBusy(false)
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      await load(await file.text())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Import program</h1>
      </div>
      <p className="muted-line">
        Load the sample to look around, or import your own program file. It is
        checked against the program schema before anything is saved.
      </p>
      <div className="import-actions" style={{ marginTop: 18 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void loadSample()}
          disabled={busy}
        >
          Load sample program
        </button>
        <label className="file-label">
          <span className="btn-secondary">Import program file</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => void onFile(event)}
            disabled={busy}
          />
        </label>
      </div>
      {errors.length > 0 && (
        <div className="errors">
          <div className="errors__title">
            {errors.length === 1 ? '1 problem' : `${errors.length} problems`} — nothing was saved
          </div>
          <ul className="errors__list">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
