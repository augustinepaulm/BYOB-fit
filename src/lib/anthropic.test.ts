import { describe, expect, it } from 'vitest'

import {
  buildRequest,
  readErrorMessage,
  readResponseText,
  stripCodeFences,
} from './anthropic.ts'

const request = {
  apiKey: 'sk-ant-test',
  model: 'claude-sonnet-5',
  maxTokens: 2048,
  system: 'You are a program writer.',
  messages: [{ role: 'user' as const, content: 'hello' }],
}

describe('buildRequest', () => {
  it('posts to the Messages endpoint', () => {
    const { url, init } = buildRequest(request)
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.method).toBe('POST')
  })

  it('sends the four required headers', () => {
    const { init } = buildRequest(request)
    expect(init.headers).toEqual({
      'x-api-key': 'sk-ant-test',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
  })

  it('sends model, max_tokens, system and messages', () => {
    const { init } = buildRequest(request)
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system: 'You are a program writer.',
      messages: [{ role: 'user', content: 'hello' }],
    })
  })

  it('keeps the key out of the body', () => {
    const { init } = buildRequest(request)
    expect(String(init.body)).not.toContain('sk-ant-test')
  })
})

describe('readResponseText', () => {
  it('joins the text blocks', () => {
    expect(
      readResponseText({
        content: [
          { type: 'text', text: 'one ' },
          { type: 'text', text: 'two' },
        ],
      }),
    ).toEqual({ ok: true, text: 'one two' })
  })

  it('ignores non-text blocks', () => {
    expect(
      readResponseText({
        content: [{ type: 'thinking', thinking: 'hmm' }, { type: 'text', text: 'hi' }],
      }),
    ).toEqual({ ok: true, text: 'hi' })
  })

  it('reports empty content rather than returning an empty string', () => {
    expect(readResponseText({ content: [] }).ok).toBe(false)
    expect(readResponseText({}).ok).toBe(false)
  })
})

describe('readErrorMessage', () => {
  it('surfaces the API error message', () => {
    expect(
      readErrorMessage(
        401,
        JSON.stringify({
          type: 'error',
          error: { type: 'authentication_error', message: 'invalid x-api-key' },
        }),
      ),
    ).toBe('401: invalid x-api-key')
  })

  it('falls back to the raw body', () => {
    expect(readErrorMessage(500, 'upstream boom')).toBe('500: upstream boom')
  })

  it('falls back to the status when the body is empty', () => {
    expect(readErrorMessage(503, '   ')).toBe('HTTP 503')
  })
})

describe('stripCodeFences', () => {
  it('unwraps a json fence', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('unwraps a bare fence', () => {
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('leaves unfenced text alone', () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}')
  })
})
