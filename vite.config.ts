import { createHash } from 'node:crypto'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * D-066 rule 3: a Content-Security-Policy on the production build only (the
 * dev server needs inline and eval'd modules). The inline theme script is
 * allowed by the sha256 of its text as it stands in the HTML being built, so
 * editing it cannot silently break the page. No 'unsafe-eval': the program
 * schema validators are compiled ahead of time (D-066 rule 2).
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'byob-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
        if (inline.length !== 1) throw new Error(`CSP: expected one inline script in index.html, found ${inline.length}`)
        const hash = createHash('sha256').update(inline[0][1]).digest('base64')
        const policy = [
          "default-src 'self'",
          `script-src 'self' 'sha256-${hash}'`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "connect-src 'self' https://api.anthropic.com",
          "worker-src 'self'",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
        const charset = /<meta charset=[^>]*>/i
        if (!charset.test(html)) throw new Error('CSP: no <meta charset> in index.html')
        return html.replace(charset, (tag) => `${tag}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/BYOB-fit/',
  plugins: [
    react(),
    contentSecurityPolicy(),
    // EXEC-05 tasks 2 and 3. generateSW, never injectManifest. 'prompt' means a
    // new version waits for the user to tap Reload; nothing reloads mid-session.
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      // The globPatterns below already cover the icons; avoid duplicate entries.
      includeManifestIcons: false,
      manifest: {
        name: 'BYOB-fit',
        short_name: 'BYOB-fit',
        description: 'Build Your Own Body: a bring-your-own-model workout PWA',
        // Dark Ground, PLAN v1.5 section 12 (D-034).
        theme_color: '#161816',
        background_color: '#161816',
        display: 'standalone',
        start_url: '/BYOB-fit/',
        scope: '/BYOB-fit/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell: hashed JS and CSS (cache-first via precache), the
        // HTML, and the icons. The manifest is added by the plugin.
        // Starter programs are precached so onboarding works offline (EXEC-07),
        // and the bundled fonts so the app never falls back offline (D-083 rule 5).
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}', 'templates/*.json'],
        // The sample program is never precached; it is network-first below.
        globIgnores: ['**/sample-program.json'],
        cleanupOutdatedCaches: true,
        // The only runtime route. It matches same-origin requests only, so
        // api.anthropic.com (or any other origin) never reaches a handler and
        // the service worker does not call respondWith for it.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.endsWith('/sample-program.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sample-program',
              expiration: { maxEntries: 1 },
            },
          },
        ],
      },
    }),
  ],
})
