import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
const srcDir = fileURLToPath(new URL('src', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: { __SINGLE_FILE__: 'false' },
    plugins: [vue()],

    base: '/',
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: '.',
      assetsInlineLimit: 0,
      cssCodeSplit: true,
      cssMinify: false,
      sourcemap: true,
      minify: false,
      rollupOptions: {
        input: {
          index: path.resolve(import.meta.dirname, 'index.html'),
        },
        output: {
          preserveModules: true,
          keepNames: true,
          entryFileNames: (fileInfo) => {
            const id = fileInfo.facadeModuleId;
            if (!id) return 'js/[name].js';
            var result = id.substring(0, id.lastIndexOf('.') || undefined) + '.js';
            if (result === '.js') {
              result = 'js/[name].js';
            }
            if (result.includes('?')) {
              result = result.split('?')[0];
            }
            const vue_suffix = '.vue';
            if (result.endsWith(vue_suffix)) {
              result = result.slice(0, -vue_suffix.length) + '.js';
            }
            if (result.includes('..') || result.includes('\0')) {
              result = result.replace(/\.\./g, '_');
              result = result.replace(/\0/g, '_');
              return 'js/_virtual/' + result;
            }
            var rel = path.relative(srcDir, result).replace(/\\/g, '/');
            const node_prefix = '../node_modules';
            if (rel.startsWith(node_prefix)) {
              rel = 'node_modules' + rel.slice(node_prefix.length);
            }
            return 'js/' + rel;
          },
          chunkFileNames: (fileInfo) => {
            const id = fileInfo.facadeModuleId;
            if (!id) return 'js/_chunks/[name].js';
            var result = id.substring(0, id.lastIndexOf('.') || undefined) + '.js';
            if (result === '.js') {
              result = 'js/[name].js';
            }
            if (result.includes('?')) {
              result = result.split('?')[0];
            }
            const vue_suffix = '.vue';
            if (result.endsWith(vue_suffix)) {
              result = result.slice(0, -vue_suffix.length) + '.js';
            }
            if (result.includes('..') || result.includes('\0')) {
              result = result.replace(/\.\./g, '_');
              result = result.replace(/\0/g, '_');
              return 'js/_chunks/_virtual/' + result;
            }
            var rel = path.relative(srcDir, result).replace(/\\/g, '/');
            const node_prefix = '../node_modules';
            if (rel.startsWith(node_prefix)) {
              rel = 'node_modules' + rel.slice(node_prefix.length);
            }
            return 'js/_chunks/' + rel;
          },
          assetFileNames(assetInfo) {
            const name = assetInfo.originalFileNames[0] || '';
            const src_prefix = 'src/';
            if (!name.startsWith(src_prefix)) {
              return 'res/[name][extname]';
            }
            var rel = name.slice(src_prefix.length);
            if (rel.includes('?')) {
              rel = rel.split('?')[0];
            }
            const vue_suffix = '.vue';
            if (rel.endsWith(vue_suffix)) {
              rel = rel.slice(0, -vue_suffix.length) + '.css';
              if (rel.includes('..') || rel.includes('\0')) {
                rel = rel.replace(/\.\./g, '_');
                rel = rel.replace(/\0/g, '_');
                return 'css/_virtual/' + rel;
              }
              const node_prefix = '../node_modules';
              if (rel.startsWith(node_prefix)) {
                rel = 'node_modules' + rel.slice(node_prefix.length);
              }
              return 'css/' + rel;
            }
            const style_suffix = '.css';
            if (rel.endsWith(style_suffix)) {
              return 'css/' + rel;
            }
            return 'res/' + rel;
          },
        },
      },
      emptyOutDir: true,
      reportCompressedSize: false,
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

    publicDir: 'public',
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
    },
  }
})
