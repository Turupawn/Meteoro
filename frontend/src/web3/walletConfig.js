/**
 * Rise Wallet Configuration
 * Centralized configuration for Rise Wallet integration
 */

import { riseTestnet } from 'viem/chains'

// Contract addresses
export const CONTRACT_ADDRESS = import.meta.env.CONTRACT_ADDRESS
export const WSS_URL = import.meta.env.WSS_URL || 'wss://testnet.riselabs.xyz'
export const RPC_URL = 'https://testnet.riselabs.xyz'

// Chain configuration
export const CHAIN = riseTestnet

// Gas configuration
export const GAS_LIMIT = 300000
export const GAS_FEE_BUFFER_ETH = 0.0000001

// Session key configuration
// Note: Rise Wallet may have maximum limits on expiry time
export const SESSION_KEY_EXPIRY_SECONDS = 604800 // 7 days (7 * 24 * 60 * 60)
export const SESSION_KEY_STORAGE_PREFIX = 'meteoro.sessionKey'

// Balance polling
export const BALANCE_POLL_INTERVAL = 1000

// Export for convenience
export default {
  CONTRACT_ADDRESS,
  WSS_URL,
  RPC_URL,
  CHAIN,
  GAS_LIMIT,
  GAS_FEE_BUFFER_ETH,
  SESSION_KEY_EXPIRY_SECONDS,
  SESSION_KEY_STORAGE_PREFIX,
  BALANCE_POLL_INTERVAL
}
