import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA instalable y offline (RNF-3). El modelo de idioma del OCR se precachea
    // para que el lector funcione sin conexion desde la primera visita.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Rosimar S.A.S. - Hojas de Vida y Talento Humano',
        short_name: 'Rosimar TH',
        description:
          'Lector de hojas de vida y gestion de talento humano de Rosimar S.A.S. Funciona sin conexion.',
        lang: 'es-CO',
        start_url: '/',
        display: 'standalone',
        background_color: '#f9f8f6',
        theme_color: '#2a5234',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // El nucleo WASM y los modelos de idioma pesan varios MB cada uno.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // El motor de OCR NO se precachea: son ~10 MB por variante y el navegador
        // solo usa una. Se guarda en cache la primera vez que se lee un documento.
        globIgnores: ['**/tesseract/**', '**/tessdata/**'],
        // El motor de OCR se guarda en cache la primera vez que se usa, para no
        // imponer una descarga de ~15 MB en la primera visita. A partir de ahi el
        // lector funciona sin conexion.
        runtimeCaching: [
          {
            urlPattern: /\/(?:tessdata|tesseract)\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'motor-ocr',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
