import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { saveProgram, setActiveProgram } from '../db/index.ts'
import { importProgramText } from '../lib/importProgram.ts'
import { recordStoragePersistence } from '../lib/storage.ts'
import { useProgram } from '../program/useProgram.ts'
import type { Program } from '../types/program.ts'
import { ImportErrorState } from '../ui/StateBlock.tsx'

export function ImportScreen() {
  const { refresh } = useProgram()
  const navigate = useNavigate()
  const [errors, setErrors] = useState<string[]>([])
  // 7e: a file that fails the checks; the sample's fetch errors stay as before.
  const [fileFailed, setFileFailed] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  async function activate(program: Program) {
    await saveProgram(program)
    await setActiveProgram(program.id)
    // First successful import asks for persistent storage; never blocks.
    void recordStoragePersistence()
    await refresh()
    navigate('/', { replace: true })
  }

  async function load(text: string, fromFile = false) {
    const result = importProgramText(text)
    if (!result.ok) {
      setErrors(result.errors)
      setFileFailed(fromFile)
      return
    }
    setErrors([])
    setFileFailed(false)
    await activate(result.program)
  }

  async function loadSample() {
    setFileName(null)
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
    setFileName(file.name)
    setBusy(true)
    try {
      await load(await file.text(), true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-v3 import-v3">
        <h1 className="page-v3__title">Import program</h1>
        <p className="page-v3__lead">
          Load the sample to look around, or import your own program file. It is checked against the program schema before anything is saved.
        </p>
      </div>
      {busy && (
        // 4.05: reading a file.
        <section className="card-v3 import-busy" role="status">
          <h2 className="card-v3__title">{fileName ? `Reading ${fileName}` : 'Loading the sample program'}</h2>
          <p className="lrow__sub">Checking days and exercises.</p>
          <p className="lrow__sub">Nothing is saved until the file passes every check.</p>
        </section>
      )}
      {fileFailed && <ImportErrorState errors={errors} onChoose={() => fileInput.current?.click()} />}
      {errors.length > 0 && !fileFailed && (
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
      <div className="actions-v3 import-v3__actions">
        <button type="button" className="btn btn--primary" onClick={() => void loadSample()} disabled={busy}>
          Load sample program
        </button>
        <label className="btn btn--secondary import-v3__file">
          Import program file
          <input ref={fileInput} type="file" accept=".json,application/json" className="visually-hidden" onChange={(event) => void onFile(event)} disabled={busy} />
        </label>
      </div>
    </div>
  )
}
