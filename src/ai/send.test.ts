import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SentLogEntry } from '../types/stores.ts'
import { sendAndLog, sentStatusOf, type SendLogStore } from './send.ts'

// D-050 rule 1: written before sending, then marked sent or failed.
function memoryStore() {
  const entries = new Map<string, SentLogEntry>()
  const order: string[] = []
  const store: SendLogStore = {
    append: async (entry) => {
      order.push(`append:${entry.status ?? 'none'}`)
      entries.set(entry.id, entry)
    },
    setStatus: async (id, status, error) => {
      order.push(`status:${status}`)
      const entry = entries.get(id)!
      entries.set(id, error === undefined ? { ...entry, status } : { ...entry, status, error })
    },
  }
  return { store, entries, order }
}

const input = {
  kind: 'meals' as const,
  level: 'minimal' as const,
  payload: { message: '{"lines":["x"]}', summary: [{ label: 'Meal lines', value: '1 line' }] },
  system: 'sys',
  settings: { apiKey: 'sk-ant-test', model: 'claude-sonnet-5' },
  maxTokens: 10,
  timeoutMs: 5000,
}

afterEach(() => vi.unstubAllGlobals())

describe('sendAndLog status (D-050 rule 1)', () => {
  it('success: logged before the request, then sent', async () => {
    const { store, entries, order } = memoryStore()
    const fetchMock = vi.fn(async () => {
      order.push('fetch')
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendAndLog(input, store)
    expect(result.ok).toBe(true)
    expect(order).toEqual(['append:none', 'fetch', 'status:sent'])
    const [entry] = [...entries.values()]
    expect(entry.status).toBe('sent')
    expect(entry.error).toBeUndefined()
    expect(entry.payload).toBe(input.payload.message)
  })

  it('HTTP error: failed, with the error message', async () => {
    const { store, entries } = memoryStore()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401 })))
    const result = await sendAndLog(input, store)
    expect(result.ok).toBe(false)
    const [entry] = [...entries.values()]
    expect(entry.status).toBe('failed')
    expect(entry.error).toBe('401: invalid x-api-key')
  })

  it('network error: failed, with the error message', async () => {
    const { store, entries } = memoryStore()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await sendAndLog(input, store)
    const [entry] = [...entries.values()]
    expect(entry.status).toBe('failed')
    expect(entry.error).toBe('Could not reach the model: Failed to fetch')
  })

  it('a reply that is not usable still reached the API: sent', async () => {
    const { store, entries } = memoryStore()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    const result = await sendAndLog(input, store)
    expect(result.ok).toBe(false)
    expect([...entries.values()][0].status).toBe('sent')
  })

  it('an old entry without status reads as sent', () => {
    const old: SentLogEntry = { id: 'a', at: '2026-09-20T09:00:00.000Z', kind: 'update', privacyLevel: 'minimal', payloadSummary: '', payload: '{}' }
    expect(sentStatusOf(old)).toBe('sent')
    expect(sentStatusOf({ ...old, status: 'failed', error: 'x' })).toBe('failed')
  })
})

describe('model and usage on the sent log (D-085 rule 1)', () => {
  function withUsageStore() {
    const entries = new Map<string, SentLogEntry>()
    const store: SendLogStore = {
      append: async (entry) => void entries.set(entry.id, entry),
      setStatus: async (id, status, error, usage) => {
        const entry = entries.get(id)!
        entries.set(id, { ...entry, status, ...(error !== undefined ? { error } : {}), ...usage })
      },
    }
    return { store, entries }
  }

  it('stores the model and the reply’s usage', async () => {
    const { store, entries } = withUsageStore()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 12000, output_tokens: 1500 } }), { status: 200 })))
    await sendAndLog(input, store)
    const [entry] = [...entries.values()]
    expect(entry.model).toBe('claude-sonnet-5')
    expect(entry.usage).toEqual({ inputTokens: 12000, outputTokens: 1500 })
    expect(entry.usageMissing).toBeUndefined()
  })

  it('a reply with no usage counts as zero and is marked so', async () => {
    const { store, entries } = withUsageStore()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 })))
    await sendAndLog(input, store)
    const [entry] = [...entries.values()]
    expect(entry.usage).toBeUndefined()
    expect(entry.usageMissing).toBe(true)
  })

  it('a call that never reached the API records no usage', async () => {
    const { store, entries } = withUsageStore()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await sendAndLog(input, store)
    const [entry] = [...entries.values()]
    expect(entry.usage).toBeUndefined()
    expect(entry.usageMissing).toBeUndefined()
  })
})
