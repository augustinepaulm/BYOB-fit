// Direct browser call to the Anthropic Messages API (D-004). The key is passed
// per request from the settings store and is never logged or included in any
// error text.

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

export const DEFAULT_MODEL = 'claude-sonnet-5'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface MessageRequest {
  apiKey: string
  model: string
  maxTokens: number
  system: string
  messages: Message[]
}

export type MessageResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

/** The exact request the client sends. Pure, so it can be tested without a network. */
export function buildRequest(request: MessageRequest): {
  url: string
  init: RequestInit
} {
  return {
    url: ENDPOINT,
    init: {
      method: 'POST',
      headers: {
        'x-api-key': request.apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: request.messages,
      }),
    },
  }
}

/** Pull the text out of a Messages response, or say why we cannot. */
export function readResponseText(payload: unknown): MessageResult {
  const content = (payload as { content?: unknown })?.content
  if (!Array.isArray(content)) {
    return { ok: false, error: 'The model returned no content.' }
  }
  const text = content
    .filter(
      (block): block is { type: string; text: string } =>
        typeof block === 'object' &&
        block !== null &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string',
    )
    .map((block) => block.text)
    .join('')
  if (text === '') return { ok: false, error: 'The model returned no text.' }
  return { ok: true, text }
}

/** Turn an error response body into something worth showing a person. */
export function readErrorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; type?: string }
    }
    const message = parsed.error?.message
    if (message) return `${status}: ${message}`
  } catch {
    // Not JSON; fall through to the raw body.
  }
  const trimmed = body.trim()
  return trimmed === '' ? `HTTP ${status}` : `${status}: ${trimmed.slice(0, 400)}`
}

/**
 * One request, no retries: a retry on an ambiguous failure could double-spend
 * against the user's own account.
 */
export async function sendMessage(
  request: MessageRequest,
  timeoutMs = 120_000,
): Promise<MessageResult> {
  if (!request.apiKey) {
    return { ok: false, error: 'No API key. Add one in Settings.' }
  }
  const { url, init } = buildRequest(request)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return {
        ok: false,
        error: `The request timed out after ${Math.round(timeoutMs / 1000)} seconds. Nothing was sent twice.`,
      }
    }
    return {
      ok: false,
      error: `Could not reach the model: ${(error as Error).message}`,
    }
  } finally {
    clearTimeout(timer)
  }

  const body = await response.text()
  if (!response.ok) return { ok: false, error: readErrorMessage(response.status, body) }

  try {
    return readResponseText(JSON.parse(body))
  } catch {
    return { ok: false, error: 'The model returned a response that was not JSON.' }
  }
}

/** Settings "Test": the smallest call that proves the key works. */
export async function testKey(
  apiKey: string,
  model: string,
): Promise<MessageResult> {
  return sendMessage(
    {
      apiKey,
      model,
      maxTokens: 16,
      system: 'Reply with the single word: ok',
      messages: [{ role: 'user', content: 'ping' }],
    },
    30_000,
  )
}

/** Models often wrap JSON in a code fence; take what is inside. */
export function stripCodeFences(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/)
  return (fenced ? fenced[1] : text).trim()
}
