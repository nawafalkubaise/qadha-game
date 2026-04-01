import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const key = (env.ANTHROPIC_API_KEY || '').trim()
              if (key) proxyReq.setHeader('x-api-key', key)
              proxyReq.setHeader('anthropic-version', '2023-06-01')
            })
          },
        },
        /** Seen Jeem API — يضيف Bearer من SEENJEEM_TOKEN (محلي فقط؛ لا يُبنى للإنتاج الثابت) */
        '/api/seenjeem': {
          target: 'https://api.seenjeemkw.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/seenjeem/, '/api'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              let token = (env.SEENJEEM_TOKEN || '').trim()
              if (token.toLowerCase().startsWith('bearer '))
                token = token.slice(7).trim()
              if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`)
            })
          },
        },
      },
    },
  }
})
