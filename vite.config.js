import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'http://localhost:5242',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
