// Every model call goes through here after the send preview (D-031, D-045):
// the entry is written to the sent log, then the exact message is sent, then
// the entry records whether the call reached the API (D-050 rule 1).

import { appendSentLog, setSentLogStatus } from '../db/index.ts'
import { sendMessage, type MessageResult } from '../lib/anthropic.ts'
import { joinSummary, type CallKind, type Payload } from '../lib/payload.ts'
import type { PrivacyLevel, SentLogEntry, Settings } from '../types/stores.ts'

/** A missing status reads as sent: entries from before D-050. */
export function sentStatusOf(entry: SentLogEntry): 'sent' | 'failed' {
  return entry.status ?? 'sent'
}

/** `sent` on any response from the API, `failed` on a network or HTTP error. */
export function statusFor(result: MessageResult): { status: 'sent' | 'failed'; error?: string } {
  if (result.ok || result.reached) return { status: 'sent' }
  return { status: 'failed', error: result.error }
}

export interface SendLogStore {
  append: (entry: SentLogEntry) => Promise<void>
  setStatus: (id: string, status: 'sent' | 'failed', error?: string) => Promise<void>
}

const DB_STORE: SendLogStore = { append: appendSentLog, setStatus: setSentLogStatus }

export async function sendAndLog(
  input: {
    kind: CallKind
    level: PrivacyLevel
    payload: Payload
    system: string
    settings: Settings
    maxTokens: number
    timeoutMs: number
  },
  store: SendLogStore = DB_STORE,
): Promise<MessageResult> {
  const at = new Date().toISOString()
  const id = `${at}__${input.kind}`
  // Written before sending: nothing is ever sent unlogged.
  await store.append({
    id,
    at,
    kind: input.kind,
    privacyLevel: input.level,
    payloadSummary: joinSummary(input.payload.summary),
    payload: input.payload.message,
  })
  const result = await sendMessage(
    {
      apiKey: input.settings.apiKey ?? '',
      model: input.settings.model ?? '',
      maxTokens: input.maxTokens,
      system: input.system,
      // D-044: the user message is the payload and nothing else.
      messages: [{ role: 'user', content: input.payload.message }],
    },
    input.timeoutMs,
  )
  const { status, error } = statusFor(result)
  await store.setStatus(id, status, error)
  return result
}
