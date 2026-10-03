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

/** D-085 rule 1: the tokens a reply reports. */
export interface Usage {
  inputTokens: number
  outputTokens: number
}

export type MessageResult =
  | { ok: true; text: string; usage?: Usage }
  /** `reached`: the API answered with a success status, but the reply was unusable. */
  | { ok: false; error: string; reached?: true; usage?: Usage }

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

/** The reply's `usage.input_tokens` and `usage.output_tokens`, when it has them. */
export function readUsage(payload: unknown): Usage | undefined {
  const usage = (payload as { usage?: { input_tokens?: unknown; output_tokens?: unknown } })?.usage
  const input = usage?.input_tokens
  const output = usage?.output_tokens
  if (typeof input !== 'number' || typeof output !== 'number' || !Number.isFinite(input) || !Number.isFinite(output)) return undefined
  return { inputTokens: input, outputTokens: output }
}

/** Pull the text out of a Messages response, or say why we cannot. Usage comes with it when the reply reports it. */
export function readResponseText(payload: unknown): MessageResult {
  const usage = readUsage(payload)
  const withUsage = <T extends MessageResult>(result: T): T => (usage ? { ...result, usage } : result)
  const content = (payload as { content?: unknown })?.content
  if (!Array.isArray(content)) {
    return withUsage({ ok: false, error: 'The model returned no content.' })
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
  if (text === '') return withUsage({ ok: false, error: 'The model returned no text.' })
  return withUsage({ ok: true, text })
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
    const result = readResponseText(JSON.parse(body))
    return result.ok ? result : { ...result, reached: true }
  } catch {
    return { ok: false, error: 'The model returned a response that was not JSON.', reached: true }
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
