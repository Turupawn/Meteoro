import { defineConfig } from 'vite'
import dotenv from 'dotenv'
dotenv.config()

export default defineConfig({
  define: {
    'import.meta.env.CONTRACT_ADDRESS': JSON.stringify(process.env.CONTRACT_ADDRESS),
    'import.meta.env.POLL_INTERVAL': JSON.stringify(process.env.POLL_INTERVAL)
  },
  optimizeDeps: {
    exclude: ['posthog-js']
  }
})