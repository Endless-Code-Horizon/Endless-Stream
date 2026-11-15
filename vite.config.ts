import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
// @ts-ignore
import { p2pMiddleware } from './server/p2pMiddleware.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'p2p-streaming-engine',
      configureServer(server) {
        server.middlewares.use(p2pMiddleware)
      },
    },
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
})
