/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base-Pfad für GitHub Pages (https://<user>.github.io/Juniorenmanagerspiel/).
// Lokal und in Tests bleibt er "/". Im Workflow wird BASE_PATH gesetzt.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Juniorenmanager',
        short_name: 'Junioren',
        description: 'Managerspiel: Baue eine Streethockey-Juniorenabteilung auf.',
        lang: 'de-CH',
        theme_color: '#1f4e5f',
        background_color: '#f5f6f4',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/portraits/'),
            handler: 'CacheFirst',
            options: { cacheName: 'portraits', expiration: { maxEntries: 1500 } }
          }
        ]
      }
    })
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
