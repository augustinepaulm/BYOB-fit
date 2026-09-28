// Persistent storage request (EXEC-05 task 5, PLAN O-2). Called after a
// successful program import; asks once, records the answer, never retries and
// never blocks. Where the API is missing the export is the backup path (D-017).

import { getSettings, saveSettings } from '../db/index.ts'
import type { Settings } from '../types/stores.ts'

/** Ask the browser once. Resolves quietly whatever happens. */
export async function recordStoragePersistence(): Promise<void> {
  try {
    const current = (await getSettings()) ?? {}
    if (current.storagePersisted !== undefined) return

    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    const patch: Partial<Settings> = { storagePersisted: false }

    if (storage && typeof storage.persist === 'function') {
      patch.storagePersisted = await storage.persist()
    }
    if (storage && typeof storage.estimate === 'function') {
      const { usage, quota } = await storage.estimate()
      patch.storageEstimate = { usage, quota, at: new Date().toISOString() }
    }

    // Re-read so a write made while persist() was pending is not lost.
    await saveSettings({ ...((await getSettings()) ?? {}), ...patch })
  } catch {
    // Degrade silently: export stays the backup path.
  }
}

/** Drop the fields that describe this device rather than the user's data. */
export function withoutDeviceStorage(settings: Settings): Settings {
  const copy = { ...settings }
  delete copy.storagePersisted
  delete copy.storageEstimate
  return copy
}
