import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/BYOB-fit/',
  plugins: [
    react(),
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
        theme_color: '#171512',
        background_color: '#171512',
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
        // Starter programs are precached so onboarding works offline (EXEC-07).
        globPatterns: ['**/*.{js,css,html,png,svg}', 'templates/*.json'],
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
