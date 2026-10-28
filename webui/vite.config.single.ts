import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: { __SINGLE_FILE__: 'false' },
    plugins: [vue()],
    base: '/',
    build: {
      outDir: 'dist-single',
    },

    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: env.API_PROXY_TARGET
        ? {
            '/api': {
              target: env.API_PROXY_TARGET,
              changeOrigin: true,
              // Opt in only for a trusted self-signed development endpoint.
              secure: env.API_PROXY_INSECURE !== 'true',
              configure(proxy) {
                proxy.on('proxyReq', (proxyReq, request) => {
                  // Browser -> Vite is same-origin. Do not forward that local
                  // Origin as if the browser were contacting the backend directly.
                  // Preserve cross-origin requests so the backend can still reject them.
                  if (request.headers.origin === `http://${request.headers.host}`)
                    proxyReq.removeHeader('origin')
                })
              },
            },
          }
        : undefined,
    },

    publicDir: 'public-single',
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
    },
  }
})