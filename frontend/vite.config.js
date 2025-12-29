import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert' // Recommended by Porto/Rise Wallet for HTTPS
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
  },
  plugins: [
    mkcert() // Creates valid local SSL certificates for HTTPS - required for Rise Wallet iframe
  ]
})