import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const apiTargetUrl = new URL(env.VITE_API_URL || 'https://serbisure-backend-staging-production.up.railway.app')
  // Keep local proxy requests on IPv4 when Django listens on 0.0.0.0.
  if (apiTargetUrl.hostname === 'localhost' && apiTargetUrl.protocol === 'http:') {
    apiTargetUrl.hostname = '127.0.0.1'
  }
  const apiTarget = apiTargetUrl.toString().replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: '0.0.0.0',
      open: false,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/ws': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          secure: true,
        }
      }
    }
  }
})
