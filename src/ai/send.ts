// Every model call goes through here after the send preview (D-031, D-045):
// the entry is written to the sent log, then the exact message is sent.

import { appendSentLog } from '../db/index.ts'
import { sendMessage, type MessageResult } from '../lib/anthropic.ts'
import { joinSummary, type CallKind, type Payload } from '../lib/payload.ts'
import type { PrivacyLevel, Settings } from '../types/stores.ts'

export async function sendAndLog(input: {
  kind: CallKind
  level: PrivacyLevel
  payload: Payload
  system: string
  settings: Settings
  maxTokens: number
  timeoutMs: number
}): Promise<MessageResult> {
  const at = new Date().toISOString()
  await appendSentLog({
    id: `${at}__${input.kind}`,
    at,
    kind: input.kind,
    privacyLevel: input.level,
    payloadSummary: joinSummary(input.payload.summary),
    payload: input.payload.message,
  })
  return sendMessage(
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
}
