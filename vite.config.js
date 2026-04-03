import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /** نفس البروكسي للتطوير (vite) والمعاينة — يوجّه /api إلى خادم قدها 3001 */
  const proxy = {
    '/api/anthropic': {
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      configure: (proxyInst) => {
        proxyInst.on('proxyReq', (proxyReq) => {
          const key = (env.ANTHROPIC_API_KEY || '').trim()
          if (key) proxyReq.setHeader('x-api-key', key)
          proxyReq.setHeader('anthropic-version', '2023-06-01')
        })
      },
    },
    '/api/content': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
    },
    '/api/rooms': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      ws: true,
    },
    '/api/health': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
    },
    '/api/realtime': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      ws: true,
    },
  }

  return {
    plugins: [react()],
    /**
     * host: من الجوال على نفس الـ Wi‑Fi: http://<IP-الكمبيوتر>:5173
     * allowedHosts: نفق عام (ngrok / Cloudflare / localtunnel)
     */
    server: {
      host: true,
      allowedHosts: true,
      proxy,
    },
    preview: {
      host: true,
      allowedHosts: true,
      proxy,
    },
  }
})
