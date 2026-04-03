import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  server: {
    host: true,
    port: 5173,
    hmr: {
      port: 5173,
      host: 'localhost',
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
    process: { env: {}, browser: true },
  },
})