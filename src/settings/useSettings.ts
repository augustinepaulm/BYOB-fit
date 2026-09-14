// The settings record, loaded once and written through on every change.

import { useCallback, useEffect, useRef, useState } from 'react'

import { getSettings, saveSettings } from '../db/index.ts'
import { DEFAULT_MODEL } from '../lib/anthropic.ts'
import type { Settings } from '../types/stores.ts'

export interface SettingsApi {
  settings: Settings
  loading: boolean
  update: (patch: Partial<Settings>) => Promise<void>
  reload: () => Promise<void>
}

const EMPTY: Settings = { model: DEFAULT_MODEL }

export function useSettings(): SettingsApi {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const ref = useRef<Settings>(EMPTY)

  const read = useCallback(async () => {
    const stored = await getSettings()
    return { ...EMPTY, ...stored }
  }, [])

  useEffect(() => {
    let live = true
    void read().then((found) => {
      if (!live) return
      ref.current = found
      setSettings(found)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [read])

  const reload = useCallback(async () => {
    const found = await read()
    ref.current = found
    setSettings(found)
    setLoading(false)
  }, [read])

  const update = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...ref.current, ...patch }
    ref.current = next
    await saveSettings(next)
    setSettings(next)
  }, [])

  return { settings, loading, update, reload }
}
