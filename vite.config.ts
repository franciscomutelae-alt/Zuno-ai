import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'zuno-disable-hmr-client-ws',
        apply: 'serve',
        transform(code, id) {
          if (id.includes('/vite/dist/client/client.mjs') || id.includes('/@vite/client')) {
            return code
              .replace(
                'transport.connect(createHMRHandler(handleMessage));',
                '/* ZUNO: HMR WebSocket disabled in preview */'
              )
              .replace(
                'throw new SendBeforeConnectError("send was called before connect");',
                'return;'
              )
              .replace(
                'throw new SendBeforeConnectError("invoke was called before connect");',
                'return;'
              )
              .replace(
                /new WebSocket\(/g,
                'void 0 && new WebSocket('
              );
          }
          if (id.includes('pwa-entry-point-loaded')) {
            return 'export default function registerDevSW() {}';
          }
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          id: '/',
          name: 'ZUNO AI — Intelligence Without Limits',
          short_name: 'ZUNO AI',
          description: 'Plataforma independente de inteligência artificial em tempo real, geração de imagens e ferramentas profissionais.',
          theme_color: '#050814',
          background_color: '#050814',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          lang: 'pt',
          categories: ['productivity', 'utilities', 'education'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['**/assets/zuno/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^\/assets\/zuno\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'zuno-showcase-assets-v1',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    build: {
      reportCompressedSize: false,
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) return 'vendor-firebase';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            if (id.includes('node_modules/motion')) return 'vendor-motion';
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled for preview frame stability
      hmr: false,
      ws: false,
      watch: null,
    },
  };
});
