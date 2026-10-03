/// <reference types="node" />
// EXEC-13-rework commit B (D-077, D-083): bundled fonts, the five tabs and
// their routes, and the tab bar stepping aside for the keyboard.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { TABS, isTypingTarget, tabFor } from './tabs.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url))
const text = (path: string) => read(path).toString('utf8')
const md5 = (path: string) => createHash('md5').update(read(path)).digest('hex')

describe('fonts (D-083 rule 5, task 3a)', () => {
  const files: Record<string, string> = {
    'bricolage-grotesque-latin.woff2': 'ecbeb05e3a924379abb5f460b33818ca',
    'bricolage-grotesque-latin-ext.woff2': 'f29f8d3317d4f4e1a4f8544dda33b859',
    'atkinson-hyperlegible-400-latin.woff2': 'd444e1815a3a7248ddfd59e5dd00b431',
    'atkinson-hyperlegible-400-latin-ext.woff2': 'bedd1a793e822eccd00a8503aa6e686f',
    'atkinson-hyperlegible-700-latin.woff2': 'c6b471cbb2b98ff523c57ff9b9f1eeb6',
    'atkinson-hyperlegible-700-latin-ext.woff2': 'c23ae1f7f70862fa97b79519c81bd6b2',
    'OFL-Bricolage-Grotesque.txt': 'ca124d9da1494f1d3c650b05144c8ceb',
    'OFL-Atkinson-Hyperlegible.txt': 'd7370c968457d6a437c72ef772f25ee9',
  }
  for (const [name, hash] of Object.entries(files)) {
    it(`${name} has md5 ${hash}`, () => {
      expect(md5(`../../public/fonts/${name}`)).toBe(hash)
    })
  }

  const css = text('../index.css')
  const faces = css.match(/@font-face\s*{[^}]*}/g) ?? []

  it('declares one @font-face per woff2 file, all served by the app', () => {
    expect(faces).toHaveLength(6)
    for (const face of faces) {
      const src = face.match(/src:\s*url\('([^']+)'\)/)?.[1]
      expect(src, face).toMatch(/^\/fonts\/[a-z0-9-]+\.woff2$/)
      expect(Object.keys(files)).toContain(src!.slice('/fonts/'.length))
      expect(face).toContain('unicode-range:')
    }
  })

  it('declares Bricolage Grotesque as a variable font, weight 400 to 800 and width 75 to 100', () => {
    const bricolage = faces.filter((face) => face.includes("'Bricolage Grotesque'"))
    expect(bricolage).toHaveLength(2)
    for (const face of bricolage) {
      expect(face).toContain('font-weight: 400 800;')
      expect(face).toContain('font-stretch: 75% 100%;')
    }
  })

  it('loads nothing from another origin and keeps the font policy (D-066)', () => {
    expect(css).not.toMatch(/url\(\s*['"]?https?:/)
    expect(css).not.toContain('@import')
    expect(text('../../vite.config.ts')).toContain(`"font-src 'self'"`)
  })

  it('the service worker precaches the fonts', () => {
    expect(text('../../vite.config.ts')).toContain("globPatterns: ['**/*.{js,css,html,png,svg,woff2}'")
  })
})

describe('tabs and routes (D-077, D-083 rule 6, task 5)', () => {
  it('has five tabs in order', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Train', 'Meals', 'Body', 'Progress', 'Profile'])
  })

  it.each([
    ['/', 'train'],
    ['/week', 'train'],
    ['/deck', 'train'],
    ['/meals', 'meals'],
    ['/body', 'body'],
    ['/body/new', 'body'],
    ['/body/history', 'body'],
    ['/progress/training', 'progress'],
    ['/progress/nutrition', 'progress'],
    ['/progress/body', 'progress'],
    ['/progress/training/back-squat', 'progress'],
    ['/profile', 'profile'],
    ['/settings', 'profile'],
    ['/settings/privacy', 'profile'],
    ['/settings/sent-log', 'profile'],
    ['/goal', 'profile'],
    ['/review', 'profile'],
  ])('%s belongs to %s', (path, tab) => {
    expect(tabFor(path)).toBe(tab)
  })

  it('full-screen flows belong to no tab', () => {
    for (const path of ['/welcome', '/import', '/build', '/program/new', '/program/edit']) expect(tabFor(path)).toBeNull()
  })

  const app = text('../App.tsx')
  const tabbed = (() => {
    // Every route element between a TabbedLayout opening and its closing Route.
    const blocks = app.split('<Route element={<TabbedLayout />}>').slice(1)
    return blocks.map((block) => block.slice(0, block.indexOf('</Route>\n'))).join('\n')
  })()

  it('every tab route and Profile page shows the tab bar', () => {
    for (const path of ['/', '/week', '/deck', '/meals', '/body', '/body/new', '/body/history', '/progress/training', '/progress/training/:exerciseId', '/progress/nutrition', '/progress/body', '/profile', '/settings', '/goal', '/review', '/settings/privacy', '/settings/sent-log', '/settings/foods']) {
      expect(tabbed, path).toContain(`path="${path}"`)
    }
  })

  it('onboarding, import and the builder stay full-screen', () => {
    for (const path of ['/welcome', '/import', '/build', '/program/new', '/program/edit']) {
      expect(tabbed, path).not.toContain(`path="${path}"`)
      expect(app, path).toContain(`path="${path}"`)
    }
  })

  it('/log and /log/:exerciseId redirect to Progress > Training', () => {
    expect(app).toContain('<Route path="/log" element={<LogRedirect />} />')
    expect(app).toContain('<Route path="/log/:exerciseId" element={<LogRedirect />} />')
    expect(app).toContain("<Navigate replace to={exerciseId ? `/progress/training/${exerciseId}` : '/progress/training'} />")
  })
})

describe('the tab bar hides while a field has focus (D-077 rule 2)', () => {
  it.each([
    [{ tagName: 'INPUT', type: 'text' }, true],
    [{ tagName: 'INPUT', type: 'number' }, true],
    [{ tagName: 'input', type: 'search' }, true],
    [{ tagName: 'INPUT' }, true],
    [{ tagName: 'TEXTAREA' }, true],
    [{ tagName: 'DIV', isContentEditable: true }, true],
    [{ tagName: 'INPUT', type: 'checkbox' }, false],
    [{ tagName: 'INPUT', type: 'file' }, false],
    [{ tagName: 'BUTTON' }, false],
    [{ tagName: 'BODY' }, false],
  ])('%o is typing: %s', (element, typing) => {
    expect(isTypingTarget(element)).toBe(typing)
  })

  it('nothing focused is not typing', () => {
    expect(isTypingTarget(null)).toBe(false)
  })

  it('the stylesheet hides both bars while the keyboard flag is set', () => {
    const css = text('./v3.css')
    expect(css).toMatch(/:root\[data-keyboard='open'\] \.tabbar,\s*:root\[data-keyboard='open'\] \.inprogress \{\s*display: none;/)
    const shell = text('./AppShell.tsx')
    expect(shell).toContain("root.dataset.keyboard = 'open'")
    expect(shell).toContain("document.addEventListener('focusin', sync)")
  })

  it('v3.css carries no colour literal; every colour is a token', () => {
    expect(text('./v3.css').match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([])
  })
})
