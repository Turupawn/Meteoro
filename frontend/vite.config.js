import { defineConfig } from 'vite'
import dotenv from 'dotenv'
dotenv.config()

export default defineConfig({
  define: {
    'import.meta.env.CONTRACT_ADDRESS': JSON.stringify(process.env.CONTRACT_ADDRESS),
    'import.meta.env.WSS_URL': JSON.stringify(process.env.WSS_URL || 'wss://testnet.riselabs.xyz'),
    'import.meta.env.NETWORK': JSON.stringify(process.env.NETWORK || 'rise testnet')
  },
  optimizeDeps: {
    exclude: ['posthog-js']
  }
})