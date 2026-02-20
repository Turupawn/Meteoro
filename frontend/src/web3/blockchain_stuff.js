import { createPublicClient, webSocket, formatEther, formatUnits, encodeFunctionData, custom, createClient } from 'viem'
import { riseTestnet } from 'viem/chains'
import { shredActions, sendRawTransactionSync, watchShreds } from 'shreds/viem'
import { RiseWallet } from 'rise-wallet'
import { printLog } from '../utils/utils.js'
import { captureBlockchainError } from '../session_tracking.js'
import { showErrorModal } from '../menus/errorModal.js'
import gameState, { updateBalances, updateBetConfiguration, updateGameState } from '../gameState.js'

import {
  CONTRACT_ADDRESS as MY_CONTRACT_ADDRESS,
  WSS_URL,
  GAS_LIMIT,
  GAS_FEE_BUFFER_ETH,
  BALANCE_POLL_INTERVAL,
  CHAIN
} from './walletConfig.js'

import {
  getActiveSessionKey,
  isSessionKeyValid,
  createSessionKey as createNewSessionKey,
  signWithSessionKey,
  getSessionKeyTimeRemaining,
  clearAllSessionKeys
} from './sessionKeyManager.js'

import { getFunctionSelector } from './gamePermissions.js'

const TWO_PARTY_WAR_GAME_ABI_PATH = "/json_abi/TwoPartyWarGame_v3.json"
const USDC_ABI_PATH = "/json_abi/USDC.json"

let twoPartyWarGameAbi = null
let usdcAbi = null
let usdcAddress = null
let gachaTokenAddress = null

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true, internalType: 'address' },
      { name: 'to', type: 'address', indexed: true, internalType: 'address' },
      { name: 'value', type: 'uint256', indexed: false, internalType: 'uint256' }
    ],
    anonymous: false
  }
]

let wsClient
let walletClient
let riseWalletInstance // Store instance to access provider
let eventUnwatch = null
let balancePoll = null
let gachaTokenBalanceUnwatch = null
let usdcBalanceUnwatch = null
let sessionKeyHasUsdcPermissions = false

// Update session key to include USDC approve permission AND spend limits
// NOTE: This is now effectively disabled because we use passkey for USDC approval.
// Session keys are only used for rollDice (game contract calls).
// The passkey approach avoids Rise's random session key selection bug.
async function updateSessionKeyWithUsdcPermissions() {
  // DISABLED: We now use passkey for USDC approval (see rollDice function)
  // Session keys have a bug where Rise backend randomly picks from registered keys
  // and we can't revoke old keys that don't have USDC permissions.
  console.log('🔑 Skipping session key update (USDC approval uses passkey instead)')
  sessionKeyHasUsdcPermissions = true // Flag to prevent this from being called again
  return

  // ---- OLD CODE BELOW (disabled) ----
  if (!usdcAddress) {
    console.log('🔑 Cannot update session key - USDC address not yet known')
    return
  }

  if (sessionKeyHasUsdcPermissions) {
    console.log('🔑 Session key already has USDC permissions (flag set)')
    return
  }

  const wallet = getLocalWallet()
  if (!wallet || !riseWalletInstance) {
    console.log('🔑 Cannot update session key - wallet not connected')
    return
  }

  // Check if we have ANY existing session key
  // DON'T create new ones - that just adds more keys to Rise's backend and lowers
  // the probability of the relayer picking a valid one (since we can't revoke old keys)
  // We'll rely on retry logic for the approval instead
  const existingKey = getActiveSessionKey(wallet.address)

  if (existingKey) {
    console.log('🔑 Found existing session key - will NOT create new one (can\'t revoke old keys)')
    console.log('🔑 Key:', existingKey.publicKey?.slice(0, 20) + '...')
    console.log('🔑 Will rely on retry logic if backend picks wrong key')
    sessionKeyHasUsdcPermissions = true // Assume it might have permissions, retry will handle it
    return
  }

  // Only create a new session key if we have NONE at all
  console.log('🔑 No existing session key found, creating one with USDC permissions')

  console.log('🔑 Creating new session key with USDC permissions...')
  console.log('🔑 USDC address:', usdcAddress)

  // IMPORTANT: First, try to revoke ALL old session keys from the Rise backend
  // This is necessary because the relayer may randomly pick old keys without USDC permissions
  const { getStoredSessionKeys } = await import('./sessionKeyManager.js')
  const oldKeys = getStoredSessionKeys()
  console.log('🔑 Found', oldKeys.length, 'old session keys to revoke')

  for (const oldKey of oldKeys) {
    if (oldKey.publicKey) {
      try {
        console.log('🔑 Revoking old session key:', oldKey.publicKey.slice(0, 20) + '...')
        await riseWalletInstance.provider.request({
          method: 'wallet_revokePermissions',
          params: [{ publicKey: oldKey.publicKey }]
        })
        console.log('🔑 Successfully revoked old key')
      } catch (revokeError) {
        // May already be revoked or not exist on backend
        console.log('🔑 Could not revoke old key (may already be revoked):', revokeError.message)
      }
    }
  }

  // Create additional calls for USDC approve and transfer
  const usdcCalls = [
    {
      to: usdcAddress,
      signature: getFunctionSelector('approve(address,uint256)')
    },
    {
      to: usdcAddress,
      signature: getFunctionSelector('transfer(address,uint256)')
    }
  ]

  // Create USDC spend limit - 1000 USDC per day (USDC has 6 decimals)
  // 1000 * 10^6 = 1000000000 = 0x3B9ACA00
  const usdcSpendLimit = {
    limit: '0x3B9ACA00', // 1000 USDC in 6 decimal units
    period: 'day',
    token: usdcAddress
  }

  try {
    // Clear existing session keys and create new one with USDC permissions
    clearAllSessionKeys()

    await createNewSessionKeyWithUsdcSpend(riseWalletInstance.provider, wallet.address, usdcCalls, usdcSpendLimit)
    sessionKeyHasUsdcPermissions = true
    console.log('🔑 Session key updated with USDC permissions and spend limit')
  } catch (error) {
    console.error('🔑 Failed to create session key with USDC permissions:', error)
    // Non-fatal - user can still play but will need passkey for each transaction
  }
}

// Create session key with USDC-specific spend limits
async function createNewSessionKeyWithUsdcSpend(provider, walletAddress, additionalCalls, usdcSpendLimit) {
  const { P256, PublicKey } = await import('ox')
  const { SESSION_KEY_EXPIRY_SECONDS, SESSION_KEY_STORAGE_PREFIX } = await import('./walletConfig.js')
  const { GAME_PERMISSIONS } = await import('./gamePermissions.js')

  console.log('🔑 Creating session key with USDC spend limit...')

  // Merge base permissions with additional calls and USDC spend limit
  const permissions = {
    calls: [...(GAME_PERMISSIONS.calls || []), ...additionalCalls],
    spend: [...(GAME_PERMISSIONS.spend || []), usdcSpendLimit]
  }

  console.log('🔑 Merged permissions with USDC:', JSON.stringify(permissions, null, 2))

  const privateKey = P256.randomPrivateKey()
  const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), {
    includePrefix: false
  })

  const expiry = Math.floor(Date.now() / 1000) + SESSION_KEY_EXPIRY_SECONDS

  const permissionParams = [{
    key: {
      type: 'p256',
      publicKey: publicKey
    },
    expiry: expiry,
    permissions: permissions,
    feeToken: {
      token: '0x0000000000000000000000000000000000000000',
      limit: '10000000000000000'
    }
  }]

  console.log('🔑 Permission params with USDC spend:', JSON.stringify(permissionParams, null, 2))

  const response = await provider.request({
    method: 'wallet_grantPermissions',
    params: permissionParams
  })

  const sessionKeyData = {
    privateKey: privateKey,
    publicKey: publicKey,
    expiry: expiry,
    createdAt: Date.now(),
    address: walletAddress,
    permissions: permissions
  }

  // Store in localStorage
  const storageKey = `${SESSION_KEY_STORAGE_PREFIX}.${publicKey}`
  localStorage.setItem(storageKey, JSON.stringify(sessionKeyData))

  console.log('🔑 Session key with USDC spend created, expires:', new Date(expiry * 1000).toLocaleString())

  return sessionKeyData
}

export function formatBalance(weiBalance, shownDecimals = 6) {
  const balanceInEth = formatEther(weiBalance)
  return Number(balanceInEth).toFixed(shownDecimals)
}

export function formatTokenBalance(balance, decimals, shownDecimals = 2) {
  const formatted = formatUnits(balance, decimals)
  return Number(formatted).toFixed(shownDecimals)
}

export async function getUsdcBalance(address) {
  await loadUsdcAbi()
  const balance = await wsClient.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [address]
  })
  return balance
}

export async function checkUSDCAllowance() {
  const wallet = getLocalWallet()
  console.log('🔍 checkUSDCAllowance - wallet:', wallet?.address, 'usdcAddress:', usdcAddress)

  if (!wallet || !usdcAddress) {
    console.log('🔍 checkUSDCAllowance - returning 0n (no wallet or usdcAddress)')
    return 0n
  }

  const allowance = await wsClient.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [wallet.address, MY_CONTRACT_ADDRESS]
  })
  console.log('🔍 checkUSDCAllowance - allowance from contract:', allowance, 'type:', typeof allowance)
  return allowance
}

export function getUsdcAddress() {
  return usdcAddress
}

export async function mintTestUsdc() {
  if (!usdcAddress) {
    throw new Error("USDC address not initialized")
  }

  if (!riseWalletInstance) {
    throw new Error("Rise Wallet not initialized")
  }

  const wallet = getLocalWallet()
  if (!wallet) {
    throw new Error("No wallet connected")
  }

  console.log('💰 mintTestUsdc called')
  console.log('💰 USDC address:', usdcAddress)

  // mint() has no arguments, just the function selector
  const mintSelector = getFunctionSelector('mint()')

  const sendCallsParams = [{
    calls: [{
      to: usdcAddress,
      value: '0x0',
      data: mintSelector
    }]
  }]

  const response = await riseWalletInstance.provider.request({
    method: 'wallet_sendCalls',
    params: sendCallsParams
  })

  console.log('💰 mint response:', response)
  return response
}

export async function approveUSDC(amount) {
  if (!usdcAddress) {
    throw new Error("USDC address not initialized")
  }

  if (!riseWalletInstance) {
    throw new Error("Rise Wallet not initialized")
  }

  const wallet = getLocalWallet()
  if (!wallet) {
    throw new Error("No wallet connected")
  }

  console.log('💰 approveUSDC called, amount:', amount.toString())
  console.log('💰 Approving spender:', MY_CONTRACT_ADDRESS)
  console.log('💰 USDC address:', usdcAddress)
  console.log('💰 Wallet address:', wallet.address)

  printLog(['debug'], "Approving USDC:", amount.toString(), "for contract:", MY_CONTRACT_ADDRESS)

  const txData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [MY_CONTRACT_ADDRESS, amount]
  })

  console.log('💰 Approval tx data:', txData)

  // Use wallet_sendCalls for proper transaction handling with Rise Wallet
  // This ensures the transaction is properly submitted and we can track its status
  const provider = riseWalletInstance.provider

  const sendCallsParams = [{
    calls: [{
      to: usdcAddress,
      value: '0x0',
      data: txData
    }]
  }]

  console.log('💰 wallet_sendCalls params:', JSON.stringify(sendCallsParams, null, 2))

  const response = await provider.request({
    method: 'wallet_sendCalls',
    params: sendCallsParams
  })

  console.log('💰 wallet_sendCalls response:', response)

  // Extract call ID from response
  let callId
  if (typeof response === 'string') {
    callId = response
  } else if (response && response.id) {
    callId = response.id
  } else if (Array.isArray(response) && response.length > 0) {
    callId = response[0].id || response[0]
  }

  console.log('💰 Approval call ID:', callId)

  // Wait for transaction to be confirmed
  if (callId) {
    console.log('💰 Waiting for approval transaction to confirm...')
    const txHash = await waitForApprovalConfirmation(provider, callId)
    console.log('💰 Approval confirmed, tx hash:', txHash)
    return txHash
  }

  return response
}

async function waitForApprovalConfirmation(provider, callId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await provider.request({
        method: 'wallet_getCallsStatus',
        params: [callId]
      })

      console.log('💰 Approval status check', i + 1, ':', JSON.stringify(status, null, 2))

      if (status) {
        // Check for receipts array (contains actual tx hashes)
        if (status.receipts && status.receipts.length > 0) {
          const receipt = status.receipts[0]
          if (receipt.transactionHash) {
            console.log('💰 Approval confirmed with receipt:', receipt.transactionHash)
            return receipt.transactionHash
          }
        }

        // Check status field
        if (status.status === 'CONFIRMED' || status.status === 'confirmed') {
          const hash = status.transactionHash || status.hash || status.receipts?.[0]?.transactionHash || callId
          console.log('💰 Approval confirmed with status:', hash)
          return hash
        }

        // Check for failure
        if (status.status === 'FAILED' || status.status === 'failed' || status.status === 'REVERTED') {
          const errorMsg = status.error || status.reason || 'Approval transaction failed'
          throw new Error(`USDC approval failed: ${errorMsg}`)
        }
      }
    } catch (error) {
      if (error.message?.includes('failed') || error.message?.includes('USDC approval')) {
        throw error
      }
      // Silently retry on status check errors
      console.log('💰 Status check error (retrying):', error.message)
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // If we get here, assume it went through but couldn't get confirmation
  console.log('💰 Approval status check timed out, assuming success')
  return callId
}

async function loadTwoPartyWarGameAbi() {
  if (twoPartyWarGameAbi) return twoPartyWarGameAbi

  try {
    const response = await fetch(TWO_PARTY_WAR_GAME_ABI_PATH)
    twoPartyWarGameAbi = await response.json()
    printLog(['debug'], "TwoPartyWarGame ABI loaded successfully")
    return twoPartyWarGameAbi
  } catch (error) {
    console.error("Failed to load TwoPartyWarGame ABI:", error)
    throw error
  }
}

async function loadUsdcAbi() {
  if (usdcAbi) return usdcAbi

  try {
    const response = await fetch(USDC_ABI_PATH)
    usdcAbi = await response.json()
    printLog(['debug'], "USDC ABI loaded successfully")
    return usdcAbi
  } catch (error) {
    console.error("Failed to load USDC ABI:", error)
    throw error
  }
}

const RISE_WALLET_KEY = 'riseWallet'

export function getLocalWallet() {
  const walletData = localStorage.getItem(RISE_WALLET_KEY)
  if (walletData) {
    return JSON.parse(walletData)
  }
  return null
}

export async function initWeb3() {
  try {
    printLog(['debug'], "Initializing WebSocket-based blockchain connection...")
    printLog(['debug'], "WSS_URL:", WSS_URL)
    printLog(['debug'], "CONTRACT_ADDRESS:", MY_CONTRACT_ADDRESS)

    await loadTwoPartyWarGameAbi()

    const rw = RiseWallet.create();
    riseWalletInstance = rw;

    wsClient = createPublicClient({
      chain: riseTestnet,
      transport: webSocket(WSS_URL)
    }).extend(shredActions)

    walletClient = createClient({
      chain: riseTestnet,
      transport: custom(rw.provider)
    })

    console.log("Rise Wallet client created")

    const savedWallet = getLocalWallet()

    if (savedWallet && savedWallet.address) {
      console.log("Found saved wallet in localStorage:", savedWallet.address)

      try {
        const accounts = await rw.provider.request({
          method: 'eth_accounts'
        })

        if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === savedWallet.address.toLowerCase()) {
          console.log("Wallet session still valid, auto-reconnecting...")
          return { web3: wsClient, my_contract: null, wallet: savedWallet, walletClient: walletClient }
        } else {
          console.log("Wallet session expired or different account, need re-connection")
          // Clear the old Rise wallet data
          localStorage.removeItem(RISE_WALLET_KEY)
        }
      } catch (error) {
        console.log("Could not verify wallet session:", error.message)
        // Keep localStorage wallet, let user reconnect if needed
      }
    }

    console.log("Rise Wallet client create without auto-connect")
    return { web3: wsClient, my_contract: null, wallet: null, walletClient: walletClient }

  } catch (error) {
    console.error("Error initializing WebSocket client:", error)
    showErrorModal("Failed to initialize WebSocket client: " + error.message)
    throw error
  }
}

export async function warmupSdkAndCrypto() {
  const wallet = getLocalWallet()
  if (!wallet || !riseWalletInstance) {
    console.log("Cannot warmup - wallet not connected")
    return
  }

  console.log("Warming up SDK and crypto libraries...")
  const t0 = performance.now()

  try {
    let sessionKey = getActiveSessionKey(wallet.address)
    if (!sessionKey || !isSessionKeyValid(sessionKey, wallet.address)) {
      console.log("No valid session key for warmup, skipping")
      return
    }

    const dummyDigest = '0x' + '0'.repeat(64)
    try {
      signWithSessionKey(dummyDigest, sessionKey)
      console.log(`P256 crypto warmed up: ${Math.round(performance.now() - t0)}ms`)
    } catch (e) {
    }

    const provider = riseWalletInstance.provider
    const dummyParams = [{
      calls: [{
        to: wallet.address,
        value: '0x0',
        data: '0x'
      }],
      key: {
        type: 'p256',
        publicKey: sessionKey.publicKey
      }
    }]

    try {
      await provider.request({
        method: 'wallet_prepareCalls',
        params: dummyParams
      })
      console.log(`Rise Wallet SDK warmed up: ${Math.round(performance.now() - t0)}ms`)
    } catch (e) {
      // Ignore errors - we just want to warm up the SDK
      console.log(`Warmup prepareCalls failed (expected): ${Math.round(performance.now() - t0)}ms`)
    }

    console.log(`Total warmup time: ${Math.round(performance.now() - t0)}ms`)
  } catch (e) {
    console.log("Warmup error (non-critical):", e.message)
  }
}

export async function connectWallet() {
  try {
    if (!riseWalletInstance) {
      throw new Error("Rise Wallet not initialized. Call initWeb3() first.")
    }

    const provider = riseWalletInstance.provider

    console.log("Connecting to Rise Wallet...")
    console.log("Requesting accounts via eth_requestAccounts (this triggers OAuth popup)...")

    // Use eth_requestAccounts to trigger the Rise Wallet popup
    // This is the standard EIP-1193 method that opens the OAuth popup (Google, etc.)
    const accounts = await provider.request({
      method: 'eth_requestAccounts'
    })

    console.log("Connected accounts:", accounts)

    // Try to get the actual smart account address
    try {
      const capabilities = await provider.request({
        method: 'wallet_getCapabilities'
      })
      console.log("Wallet capabilities:", capabilities)
    } catch (e) {
      console.log("Could not get wallet capabilities:", e.message)
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from Rise Wallet")
    }

    const wallet = {
      address: accounts[0]
    }

    localStorage.setItem(RISE_WALLET_KEY, JSON.stringify(wallet))

    // DISABLED: Don't create session keys on connect!
    // The Rise backend already has multiple keys and we can't revoke them.
    // Creating new keys just lowers the probability of the relayer picking a valid one.
    // We'll rely on retry logic in rollDice instead.
    console.log("🔑 Skipping session key creation on connect (relying on retry logic)")

    return wallet
  } catch (error) {
    console.error("❌ Failed to connect wallet:", error)
    throw error
  }
}

// =============================================================================
// DUPLICATE NONCE RETRY WORKAROUND
// Rise Wallet relay sometimes returns stale nonces causing "duplicate call" errors.
// Set ENABLE_DUPLICATE_RETRY to false to disable the retry mechanism.
// TODO: Remove this workaround once Rise Wallet fixes their relay nonce management.
// =============================================================================
const ENABLE_DUPLICATE_RETRY = true
const MAX_DUPLICATE_RETRIES = 4
const RETRY_DELAY_MS = 500

// Track seen nonces to detect duplicates (only used when retry is enabled)
const seenNonces = new Map()

async function sendMultiCallTransaction(calls, retryCount = 0) {
  console.log('📤 sendMultiCallTransaction called with', calls.length, 'calls')

  if (!riseWalletInstance) throw new Error("Rise Wallet not initialized")

  const provider = riseWalletInstance.provider
  const wallet = getLocalWallet()
  if (!wallet) throw new Error("No wallet connected")

  let sessionKey = getActiveSessionKey(wallet.address)
  if (!sessionKey || !isSessionKeyValid(sessionKey, wallet.address)) {
    sessionKey = await createNewSessionKey(provider, wallet.address)
  }

  const prepareParams = [{
    calls: calls,
    key: { type: 'p256', publicKey: sessionKey.publicKey },
    chainId: '0x' + CHAIN.id.toString(16),
    from: wallet.address,
    atomicRequired: true
  }]

  console.log('📤 wallet_prepareCalls params (multi-call):', JSON.stringify(prepareParams, null, 2))

  const prepared = await provider.request({
    method: 'wallet_prepareCalls',
    params: prepareParams
  })

  console.log('📤 wallet_prepareCalls response (multi-call):', JSON.stringify(prepared, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2))

  const nonce = prepared.context?.quote?.quotes?.[0]?.intent?.nonce

  if (ENABLE_DUPLICATE_RETRY && nonce && seenNonces.has(nonce)) {
    if (retryCount < MAX_DUPLICATE_RETRIES) {
      console.log(`Duplicate nonce detected, retry ${retryCount + 1}/${MAX_DUPLICATE_RETRIES}...`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      return sendMultiCallTransaction(calls, retryCount + 1)
    }
  }

  if (ENABLE_DUPLICATE_RETRY && nonce) {
    seenNonces.set(nonce, Date.now())
  }

  const { digest, ...requestParams } = prepared
  const signature = signWithSessionKey(digest, sessionKey)

  const sendParams = [{ ...requestParams, signature }]

  let response
  try {
    response = await provider.request({
      method: 'wallet_sendPreparedCalls',
      params: sendParams
    })
  } catch (sendError) {
    if (ENABLE_DUPLICATE_RETRY && sendError.message?.includes('duplicate') && retryCount < MAX_DUPLICATE_RETRIES) {
      console.log(`Duplicate call error, retry ${retryCount + 1}/${MAX_DUPLICATE_RETRIES}...`)
      if (nonce) seenNonces.delete(nonce)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      return sendMultiCallTransaction(calls, retryCount + 1)
    }
    throw sendError
  }

  let callId
  if (Array.isArray(response) && response.length > 0 && response[0].id) {
    callId = response[0].id
  } else if (typeof response === 'string') {
    callId = response
  } else {
    return response
  }

  const txHash = await waitForTransactionStatus(provider, callId)

  if (ENABLE_DUPLICATE_RETRY) {
    const now = Date.now()
    for (const [n, timestamp] of seenNonces) {
      if (now - timestamp > 60000) seenNonces.delete(n)
    }
  }

  return txHash
}

async function sendSessionTransaction({ to, value, data }, retryCount = 0) {
  console.log('📤 sendSessionTransaction called with:', { to, value: value?.toString(), dataLength: data?.length })

  if (!riseWalletInstance) throw new Error("Rise Wallet not initialized")

  const provider = riseWalletInstance.provider
  const wallet = getLocalWallet()
  if (!wallet) throw new Error("No wallet connected")

  let sessionKey = getActiveSessionKey(wallet.address)
  if (!sessionKey || !isSessionKeyValid(sessionKey, wallet.address)) {
    // Create session key with USDC permissions (not just base permissions)
    console.log('📤 No valid session key, creating one with USDC permissions...')

    // Build USDC permissions
    const usdcCalls = usdcAddress ? [
      { to: usdcAddress, signature: getFunctionSelector('approve(address,uint256)') },
      { to: usdcAddress, signature: getFunctionSelector('transfer(address,uint256)') }
    ] : []

    const usdcSpendLimit = usdcAddress ? {
      limit: '0x3B9ACA00', // 1000 USDC
      period: 'day',
      token: usdcAddress
    } : null

    if (usdcAddress && usdcSpendLimit) {
      sessionKey = await createNewSessionKeyWithUsdcSpend(provider, wallet.address, usdcCalls, usdcSpendLimit)
    } else {
      sessionKey = await createNewSessionKey(provider, wallet.address)
    }
  }

  // Log which session key we're using - this should match what Rise backend uses
  console.log('📤 Using session key:', sessionKey.publicKey)
  console.log('📤 Session key has USDC permissions:', {
    hasUsdcSpend: sessionKey.permissions?.spend?.some(s => s.token && s.token !== '0x0000000000000000000000000000000000000000'),
    hasUsdcCalls: sessionKey.permissions?.calls?.length > 1,
    calls: sessionKey.permissions?.calls?.map(c => ({ to: c.to?.slice(0, 10) + '...', sig: c.signature }))
  })

  const hexValue = value ? `0x${BigInt(value).toString(16)}` : '0x0'

  const prepareParams = [{
    calls: [{ to, value: hexValue, data }],
    key: { type: 'p256', publicKey: sessionKey.publicKey },
    chainId: '0x' + CHAIN.id.toString(16),
    from: wallet.address,
    atomicRequired: true
  }]

  console.log('📤 wallet_prepareCalls params:', JSON.stringify(prepareParams, null, 2))

  const prepared = await provider.request({
    method: 'wallet_prepareCalls',
    params: prepareParams
  })

  console.log('📤 wallet_prepareCalls response:', JSON.stringify(prepared, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2))

  const nonce = prepared.context?.quote?.quotes?.[0]?.intent?.nonce

  // Duplicate nonce detection and retry (workaround for Rise Wallet relay bug)
  if (ENABLE_DUPLICATE_RETRY && nonce && seenNonces.has(nonce)) {
    if (retryCount < MAX_DUPLICATE_RETRIES) {
      console.log(`Duplicate nonce detected, retry ${retryCount + 1}/${MAX_DUPLICATE_RETRIES}...`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      return sendSessionTransaction({ to, value, data }, retryCount + 1)
    }
  }

  if (ENABLE_DUPLICATE_RETRY && nonce) {
    seenNonces.set(nonce, Date.now())
  }

  const { digest, ...requestParams } = prepared
  const signature = signWithSessionKey(digest, sessionKey)

  const sendParams = [{ ...requestParams, signature }]

  let response
  try {
    response = await provider.request({
      method: 'wallet_sendPreparedCalls',
      params: sendParams
    })
  } catch (sendError) {
    // Retry on duplicate call error (workaround for Rise Wallet relay bug)
    if (ENABLE_DUPLICATE_RETRY && sendError.message?.includes('duplicate') && retryCount < MAX_DUPLICATE_RETRIES) {
      console.log(`Duplicate call error, retry ${retryCount + 1}/${MAX_DUPLICATE_RETRIES}...`)
      if (nonce) seenNonces.delete(nonce)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      return sendSessionTransaction({ to, value, data }, retryCount + 1)
    }
    throw sendError
  }

  let callId
  if (Array.isArray(response) && response.length > 0 && response[0].id) {
    callId = response[0].id
  } else if (typeof response === 'string') {
    callId = response
  } else {
    return response
  }

  const txHash = await waitForTransactionStatus(provider, callId)

  // Clean up old nonce entries
  if (ENABLE_DUPLICATE_RETRY) {
    const now = Date.now()
    for (const [n, timestamp] of seenNonces) {
      if (now - timestamp > 60000) seenNonces.delete(n)
    }
  }

  return txHash
}

async function waitForTransactionStatus(provider, callId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await provider.request({
        method: 'wallet_getCallsStatus',
        params: [callId]
      })
      
      // Check if we have a status
      if (status) {
        // Check for receipts array (contains actual tx hashes)
        if (status.receipts && status.receipts.length > 0) {
          const receipt = status.receipts[0]
          if (receipt.transactionHash) {
            return receipt.transactionHash
          }
        }
        
        // Check status field
        if (status.status === 'CONFIRMED' || status.status === 'confirmed') {
          // Try to get tx hash from various places
          if (status.transactionHash) return status.transactionHash
          if (status.hash) return status.hash
          if (status.receipts?.[0]?.transactionHash) return status.receipts[0].transactionHash
          // If confirmed but no hash, return callId as fallback
          return callId
        }
        
        // Check for failure
        if (status.status === 'FAILED' || status.status === 'failed' || status.status === 'REVERTED') {
          const errorMsg = status.error || status.reason || 'Transaction failed'
          throw new Error(`Transaction failed: ${errorMsg}`)
        }
      }
    } catch (error) {
      // Silently retry on status check errors
      if (error.message?.includes('Transaction failed')) {
        throw error
      }
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  return callId
}

export async function checkInitialGameState() {
  const startTime = Date.now()
  try {
    const wallet = getLocalWallet()
    if (!wallet) {
      return null
    }

    console.log("=== INITIAL STATE CHECK (WebSocket) ===")
    console.log("Contract address:", MY_CONTRACT_ADDRESS)
    console.log("Wallet address:", wallet.address)
    console.log("Contract ABI loaded:", !!twoPartyWarGameAbi)
    printLog(['debug'], "Using WebSocket for initial state check")

    let gameStateTemp
    try {
      printLog(['debug'], "Using WebSocket client for initial state check...")
      // Use WebSocket client for initial state check
      gameStateTemp = await wsClient.readContract({
        address: MY_CONTRACT_ADDRESS,
        abi: twoPartyWarGameAbi,
        functionName: 'getInitialFrontendGameState',
        args: [wallet.address]
      })
      printLog(['debug'], "WebSocket initial state check successful")
    } catch (wsError) {
      printLog(['error'], "WebSocket initial state check failed:", wsError.message)
      throw wsError
    }

    console.log("=== CONTRACT CALL SUCCESSFUL ===")
    console.log("Received data:", gameStateTemp)
    console.log("Data length:", gameStateTemp.length)
    console.log("Element 8 (betAmounts):", gameStateTemp[8])
    console.log("Element 9 (betAmountMultipliers):", gameStateTemp[9])

    // Access the array elements by index according to the new ABI
    // getInitialFrontendGameState returns:
    // [0] gameState, [1] gameId, [2] playerCard, [3] houseCard,
    // [4] recentHistory, [5] tieRewardMultiplierValue, [6] betAmounts, [7] betAmountMultipliersArray,
    // [8] playerEthBalance, [9] playerGachaTokenBalance, [10] playerUsdcBalance,
    // [11] gachaTokenAddress, [12] usdcTokenAddress, [13] usdcDecimals
    const currentGameState = gameStateTemp[0]
    const gameId = gameStateTemp[1]
    const playerCard = gameStateTemp[2]
    const houseCard = gameStateTemp[3]
    const recentHistory = gameStateTemp[4]
    const tieRewardMultiplierValue = gameStateTemp[5]
    const betAmounts = gameStateTemp[6]
    const betAmountMultipliersArray = gameStateTemp[7]
    const playerEthBalance = gameStateTemp[8]
    const playerGachaTokenBalance = gameStateTemp[9]
    const playerUsdcBalance = gameStateTemp[10]
    gachaTokenAddress = gameStateTemp[11]
    usdcAddress = gameStateTemp[12]
    const usdcDecimals = gameStateTemp[13]

    // Now that we have the USDC address, update session key to include USDC permissions
    await updateSessionKeyWithUsdcPermissions()

    console.log("Bet amounts:", betAmounts)
    console.log("Bet amounts type:", typeof betAmounts)
    console.log("Bet amounts length:", betAmounts?.length)

    printLog(['debug'], "Contract call successful, received:", gameStateTemp)

    // Debug the bet amounts BEFORE any processing
    printLog(['debug'], "=== BET AMOUNTS DEBUG ===")
    printLog(['debug'], "Bet amounts array from contract:", betAmounts)
    printLog(['debug'], "Bet amounts type:", typeof betAmounts)
    printLog(['debug'], "Bet amounts length:", betAmounts?.length)
    printLog(['debug'], "Bet amounts raw:", betAmounts.map(b => b.toString()))
    printLog(['debug'], "Bet amount multipliers:", betAmountMultipliersArray)
    printLog(['debug'], "Tie reward multiplier:", tieRewardMultiplierValue)
    printLog(['debug'], "=========================")

    // Update centralized game state
    updateBalances(playerEthBalance, playerGachaTokenBalance, playerUsdcBalance)
    updateBetConfiguration(betAmounts, betAmountMultipliersArray, tieRewardMultiplierValue, usdcDecimals)

    if (!betAmounts || betAmounts.length === 0) {
      printLog(['error'], "Contract is accessible but has no bet amounts configured")
      printLog(['error'], "This means the contract owner needs to call setBetAmounts()")
      throw new Error("No bet amounts configured in contract - owner needs to set bet amounts")
    }

    const gameStateData = {
      playerEthBalance: playerEthBalance,
      playerGachaTokenBalance: playerGachaTokenBalance,
      playerUsdcBalance: playerUsdcBalance,
      gameState: BigInt(currentGameState),
      gameId: gameId,
      playerCard: playerCard,
      houseCard: houseCard,
      recentHistory: recentHistory,
      tieRewardMultiplier: tieRewardMultiplierValue,
      betAmounts: betAmounts,
      betAmountMultipliers: betAmountMultipliersArray,
      gachaTokenAddress: gachaTokenAddress,
      usdcAddress: usdcAddress,
      usdcDecimals: usdcDecimals
    }

    printLog(['profile'], "=== INITIAL GAME STATE LOAD ===")
    printLog(['profile'], "Game state loaded successfully")
    printLog(['profile'], "Time taken:", Date.now() - startTime, "ms")
    printLog(['profile'], "=============================")

    return gameStateData
  } catch (error) {
    printLog(['profile'], "=== INITIAL GAME STATE LOAD ===")
    printLog(['profile'], "Game state load failed")
    printLog(['profile'], "Time taken:", Date.now() - startTime, "ms")
    printLog(['profile'], "=============================")

    console.error("Error checking initial game state:", error)
    showErrorModal("Failed to check initial game state: " + error.message)
    captureBlockchainError(error, 'checkInitialGameState', {
      contract_address: MY_CONTRACT_ADDRESS,
      error_type: 'blockchain_call_failed'
    })

    return null
  }
}

export async function checkGameState() {
  try {
    const wallet = getLocalWallet()
    if (!wallet) {
      return null
    }

    let gameStateTemp = await wsClient.readContract({
      address: MY_CONTRACT_ADDRESS,
      abi: twoPartyWarGameAbi,
      functionName: 'getFrontendGameState',
      args: [wallet.address]
    })

    // getFrontendGameState returns:
    // [0] gameState, [1] gameId, [2] playerCard, [3] houseCard,
    // [4] playerEthBalance, [5] playerGachaTokenBalance, [6] playerUsdcBalance
    const currentGameState = gameStateTemp[0]
    const gameId = gameStateTemp[1]
    const playerCard = gameStateTemp[2]
    const houseCard = gameStateTemp[3]
    const playerEthBalance = gameStateTemp[4]
    const playerGachaTokenBalance = gameStateTemp[5]
    const playerUsdcBalance = gameStateTemp[6]

    // Update centralized game state
    updateBalances(playerEthBalance, playerGachaTokenBalance, playerUsdcBalance)

    const gameStateData = {
      playerEthBalance: playerEthBalance,
      playerGachaTokenBalance: playerGachaTokenBalance,
      playerUsdcBalance: playerUsdcBalance,
      gameState: BigInt(currentGameState),
      gameId: gameId,
      playerCard: playerCard,
      houseCard: houseCard
    }

    return gameStateData
  } catch (error) {
    console.error("Error checking game state:", error)
    showErrorModal("Failed to check game state: " + error.message)
    captureBlockchainError(error, 'checkGameState', {
      contract_address: MY_CONTRACT_ADDRESS,
      error_type: 'blockchain_call_failed'
    })

    return null
  }
}

export async function rollDice() {
  console.log('🎲 rollDice called')

  // Debug: Log all stored session keys
  const { getStoredSessionKeys } = await import('./sessionKeyManager.js')
  const allKeys = getStoredSessionKeys()
  console.log('🎲 All stored session keys:', allKeys.length)
  allKeys.forEach((key, i) => {
    console.log(`🎲 Key ${i}: pubKey=${key.publicKey?.slice(0, 20)}..., expiry=${new Date(key.expiry * 1000).toLocaleString()}, hasUsdcSpend=${key.permissions?.spend?.some(s => s.token?.toLowerCase() === usdcAddress?.toLowerCase())}`)
  })

  // Debug: Try to find the actual smart account address
  try {
    const provider = riseWalletInstance.provider
    // Get the addresses from the provider
    const ethAccounts = await provider.request({ method: 'eth_accounts' })
    console.log('🎲 eth_accounts:', ethAccounts)
  } catch (e) {
    console.log('🎲 Could not get eth_accounts:', e.message)
  }

  const wallet = getLocalWallet()
  if (!wallet) {
    const error = new Error("No local wallet found!")
    showErrorModal(error.message)
    captureBlockchainError(error, 'rollDice', {
      error_type: 'wallet_not_found'
    })
    throw error
  }

  if (!gameState.getSelectedBetAmount()) {
    await initializeBetAmount()
  }

  const betAmount = gameState.getSelectedBetAmount()
  console.log('🎲 betAmount:', betAmount?.toString())

  try {
    // Check USDC allowance
    console.log('🎲 Checking USDC allowance...')
    const currentAllowance = await checkUSDCAllowance()
    const betAmountBigInt = BigInt(betAmount)
    const allowanceBigInt = BigInt(currentAllowance || 0)
    console.log('🎲 Current allowance:', allowanceBigInt.toString(), 'betAmount:', betAmountBigInt.toString())
    const needsApproval = allowanceBigInt < betAmountBigInt
    console.log('🎲 Need approval?', needsApproval)

    // Build the calls array
    const calls = []

    // If allowance is insufficient, add approve call first
    if (needsApproval) {
      console.log('🎲 Adding USDC approve to transaction bundle...')
      const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MY_CONTRACT_ADDRESS, maxApproval]
      })
      calls.push({
        to: usdcAddress,
        value: '0x0',
        data: approveData
      })
    }

    // Add rollDice call
    const rollDiceData = encodeFunctionData({
      abi: twoPartyWarGameAbi,
      functionName: 'rollDice',
      args: [betAmount]
    })
    calls.push({
      to: MY_CONTRACT_ADDRESS,
      value: '0x0',
      data: rollDiceData
    })

    console.log('🎲 Total calls in transaction:', calls.length)

    let hash

    // If approval is needed, use PASSKEY authentication (not session key)
    // Session keys have issues: Rise backend randomly picks from registered keys, we can't revoke old ones
    // Passkey is reliable because it uses the user's actual wallet key
    if (needsApproval) {
      console.log('🎲 Approval needed - using passkey authentication (bypasses session key issues)...')

      const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MY_CONTRACT_ADDRESS, maxApproval]
      })

      try {
        // Use passkey for approval - this prompts the user but is reliable
        const approveHash = await sendBundledCallsWithPasskey([{
          to: usdcAddress,
          value: '0x0',
          data: approveData
        }])

        console.log('🎲 Approve tx hash (via passkey):', approveHash)

        // Wait a bit for the transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Verify the approval worked
        const newAllowance = await checkUSDCAllowance()
        console.log('🎲 Allowance after approve:', newAllowance?.toString())

        if (BigInt(newAllowance || 0) < betAmountBigInt) {
          throw new Error('USDC approval transaction confirmed but allowance is still insufficient')
        }

        console.log('🎲 Approval succeeded via passkey')
      } catch (approveError) {
        console.error('🎲 Passkey approval failed:', approveError)
        throw new Error(`USDC approval failed: ${approveError.message}`)
      }

      console.log('🎲 Approve confirmed, now sending rollDice...')
    }

    // Now send rollDice via session key (just the game call, no approve)
    console.log('🎲 Sending rollDice via session key...')
    hash = await sendSessionTransaction({
      to: MY_CONTRACT_ADDRESS,
      value: 0n,
      data: rollDiceData
    })

    console.log('🎲 rollDice transaction hash:', hash)
    return { transactionHash: hash, status: 'success' }
  } catch (error) {
    printLog(['error'], "rollDice error:", error)
    showErrorModal("Failed to roll dice: " + error.message)
    captureBlockchainError(error, 'rollDice', {
      error_type: 'transaction_failed',
      transaction_data: {
        to: MY_CONTRACT_ADDRESS,
        betAmount: gameState.getSelectedBetAmount()?.toString(),
        gas: GAS_LIMIT
      }
    })
    throw error
  }
}

// Send bundled calls using passkey authentication (no session key)
// This is used when we need to call contracts not in session key permissions (like USDC)
async function sendBundledCallsWithPasskey(calls) {
  console.log('📦 sendBundledCallsWithPasskey called with', calls.length, 'calls')

  if (!riseWalletInstance) throw new Error("Rise Wallet not initialized")

  const provider = riseWalletInstance.provider
  const wallet = getLocalWallet()
  if (!wallet) throw new Error("No wallet connected")

  // Use wallet_sendCalls which triggers passkey authentication
  const sendCallsParams = [{
    calls: calls,
    from: wallet.address
  }]

  console.log('📦 wallet_sendCalls params:', JSON.stringify(sendCallsParams, null, 2))

  const response = await provider.request({
    method: 'wallet_sendCalls',
    params: sendCallsParams
  })

  console.log('📦 wallet_sendCalls response:', response)

  // Extract call ID from response
  let callId
  if (typeof response === 'string') {
    callId = response
  } else if (response && response.id) {
    callId = response.id
  } else if (Array.isArray(response) && response.length > 0) {
    callId = response[0].id || response[0]
  }

  console.log('📦 Bundle call ID:', callId)

  // Wait for transaction to be confirmed
  if (callId) {
    console.log('📦 Waiting for bundled transaction to confirm...')
    const txHash = await waitForBundleConfirmation(provider, callId)
    console.log('📦 Bundle confirmed, tx hash:', txHash)
    return txHash
  }

  return response
}

async function waitForBundleConfirmation(provider, callId, maxAttempts = 120) {
  // Rise Wallet status codes:
  // 100 = PENDING (transaction submitted, waiting for confirmation)
  // 200 = CONFIRMED (transaction confirmed on-chain)
  // 400+ = FAILED

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await provider.request({
        method: 'wallet_getCallsStatus',
        params: [callId]
      })

      // Only log every 10th check to reduce noise
      if (i % 10 === 0 || i < 5) {
        console.log('📦 Bundle status check', i + 1, ':', JSON.stringify(status, null, 2))
      }

      if (status) {
        // Check for receipts array (contains actual tx hashes)
        if (status.receipts && status.receipts.length > 0) {
          const receipt = status.receipts[0]
          // Check if actually mined (blockHash not all zeros)
          if (receipt.transactionHash && receipt.blockHash && receipt.blockHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.log('📦 Bundle confirmed with receipt:', receipt.transactionHash)
            return receipt.transactionHash
          }
        }

        // Check numeric status codes (Rise Wallet uses these)
        const numericStatus = typeof status.status === 'number' ? status.status : parseInt(status.status)

        // 200 = CONFIRMED
        if (numericStatus === 200 || status.status === 'CONFIRMED' || status.status === 'confirmed') {
          const hash = status.transactionHash || status.hash || status.receipts?.[0]?.transactionHash || callId
          console.log('📦 Bundle confirmed with status:', hash)
          return hash
        }

        // 400+ = FAILED
        if (numericStatus >= 400 || status.status === 'FAILED' || status.status === 'failed' || status.status === 'REVERTED') {
          const errorMsg = status.error || status.reason || 'Transaction failed'
          throw new Error(`Bundle transaction failed: ${errorMsg}`)
        }

        // 100 = PENDING - keep waiting
        // Log progress occasionally
        if (i > 0 && i % 20 === 0) {
          console.log(`📦 Still waiting for confirmation (${i * 0.5}s elapsed, status: ${status.status})...`)
        }
      }
    } catch (error) {
      if (error.message?.includes('failed') || error.message?.includes('Bundle')) {
        throw error
      }
      console.log('📦 Status check error (retrying):', error.message)
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Timeout - check allowance to see if it worked anyway
  console.log('📦 Bundle status check timed out after', maxAttempts * 0.5, 'seconds')
  console.log('📦 Checking if approve worked despite timeout...')
  const newAllowance = await checkUSDCAllowance()
  console.log('📦 Allowance after timeout:', newAllowance?.toString())

  // If allowance is set, the transaction worked even if status didn't update
  if (newAllowance && BigInt(newAllowance) > 0n) {
    console.log('📦 Approval succeeded despite status timeout!')
    return callId
  }

  throw new Error('Transaction timed out waiting for confirmation. Please try again.')
}

export async function withdrawFunds(destinationAddress) {
  try {
    const wallet = getLocalWallet()
    if (!wallet) {
      throw new Error("No wallet connected")
    }

    if (!destinationAddress || typeof destinationAddress !== 'string' || !destinationAddress.startsWith('0x') || destinationAddress.length !== 42) {
      throw new Error("Invalid destination address")
    }

    printLog(['debug'], "Withdrawing funds via WebSocket to:", destinationAddress)

    const [currentBalance, gasPrice] = await Promise.all([
      wsClient.getBalance({ address: wallet.address }),
      wsClient.getGasPrice()
    ])

    // Get Gacha token balance
    const gachaTokenBalance = gameState.getGachaTokenBalance()

    const receipts = []

    // First, transfer Gacha tokens if user has any
    if (gachaTokenBalance > 0n) {
      printLog(['debug'], "Transferring Gacha tokens:", gachaTokenBalance.toString(), "to", destinationAddress)

      const tokenHash = await riseWalletInstance.provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: wallet.address,
          to: gachaTokenAddress,
          value: '0x0',
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [destinationAddress, gachaTokenBalance]
          }),
          gas: `0x${BigInt(GAS_LIMIT).toString(16)}`
        }]
      })

      printLog(['debug'], "Gacha token transfer transaction sent:", tokenHash)
      receipts.push(tokenHash)
    }

    // Then transfer ETH
    const valueToSend = currentBalance;

    if (valueToSend > 0n) {
      printLog(['debug'], "Transferring ETH:", valueToSend.toString(), "to", destinationAddress)

      const ethHash = await riseWalletInstance.provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: wallet.address,
          to: destinationAddress,
          value: `0x${valueToSend.toString(16)}`,
          data: '0x',
          gas: `0x${BigInt(GAS_LIMIT).toString(16)}`
        }]
      })

      printLog(['debug'], "ETH transfer transaction sent:", ethHash)
      receipts.push(ethHash)
    }

    printLog(['debug'], "Withdraw transactions completed:", receipts)
    return receipts.length === 1 ? receipts[0] : receipts
  } catch (error) {
    printLog(['error'], "Error withdrawing funds:", error)
    showErrorModal("Failed to withdraw: " + (error?.message || String(error)))
    throw error
  }
}

// Real-time event monitoring functions
export async function startEventMonitoring() {
  try {
    printLog(['debug'], "Starting real-time event monitoring...")

    const wallet = getLocalWallet()
    if (!wallet) {
      throw new Error("No local wallet found!")
    }

    // Watch for GameCompleted events filtered by player address
    const unwatch = wsClient.watchContractEvent({
      address: MY_CONTRACT_ADDRESS,
      abi: twoPartyWarGameAbi,
      eventName: 'GameCompleted',
      args: {
        player: wallet.address
      },
      onLogs: async (logs) => {
        console.log("🔔 GameCompleted event received! Logs:", logs)
        printLog(['debug'], "🔔 GameCompleted event received! Logs:", logs?.length || 0)
        try {
          const freshState = await checkGameState()
          console.log("🔔 Fresh game state after event:", freshState)
          printLog(['debug'], "🔔 Fresh game state after event:", freshState?.gameState?.toString())
          updateGameState(freshState)
        } catch (err) {
          printLog(['error'], "Error updating game state after event:", err)
        }
      },
      onError: (error) => {
        printLog(['error'], "WebSocket event monitoring error:", error)
      }
    });

    eventUnwatch = unwatch

    printLog(['debug'], "✅ Event monitoring watcher created successfully")

    balancePoll = setInterval(async () => {
      const ethBalance = await wsClient.getBalance({ address: wallet.address })
      const currentGacha = gameState.getGachaTokenBalance()
      const currentUsdc = gameState.getUsdcBalance()
      updateBalances(ethBalance, currentGacha, currentUsdc)
    }, BALANCE_POLL_INTERVAL)

    await startGachaTokenBalanceMonitoring()
    await startUsdcBalanceMonitoring()

    return eventUnwatch
  } catch (error) {
    console.error("Error starting event monitoring:", error)
    showErrorModal("Failed to start event monitoring: " + error.message)
    throw error
  }
}

// Separate monitoring for Gacha token balance using shreds
async function startGachaTokenBalanceMonitoring() {
  try {
    const wallet = getLocalWallet()
    if (!wallet) {
      throw new Error("No local wallet found!")
    }

    printLog(['debug'], "Starting Gacha token balance monitoring via shreds for:", gachaTokenAddress)

    // Get initial token balance
    const initialBalance = await wsClient.readContract({
      address: gachaTokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet.address]
    })

    // Update initial balance in game state
    const currentEthBalance = gameState.getEthBalance()
    const currentUsdc = gameState.getUsdcBalance()
    updateBalances(currentEthBalance, initialBalance, currentUsdc)
    printLog(['debug'], "Initial Gacha token balance:", initialBalance.toString())

    // Watch for Transfer events on the Gacha token contract
    const transferUnwatch = wsClient.watchContractEvent({
      address: gachaTokenAddress,
      abi: ERC20_ABI,
      eventName: 'Transfer',
      args: {
        from: wallet.address
      },
      onLogs: async (logs) => {
        // When tokens are sent from wallet, update balance
        printLog(['debug'], "Gacha token Transfer event detected, updating balance...")
        await updateGachaTokenBalance(gachaTokenAddress, wallet.address)
      },
    })

    // Also watch for transfers TO the wallet
    const receiveUnwatch = wsClient.watchContractEvent({
      address: gachaTokenAddress,
      abi: ERC20_ABI,
      eventName: 'Transfer',
      args: {
        to: wallet.address
      },
      onLogs: async (logs) => {
        // When tokens are received by wallet, update balance
        printLog(['debug'], "Gacha token Transfer event detected (receipt), updating balance...")
        await updateGachaTokenBalance(gachaTokenAddress, wallet.address)
      },
    })

    // Store both unwatch functions
    gachaTokenBalanceUnwatch = () => {
      transferUnwatch()
      receiveUnwatch()
    }

    // Combine both unwatch functions
    const originalUnwatch = gachaTokenBalanceUnwatch
    gachaTokenBalanceUnwatch = () => {
      originalUnwatch()
    }

    printLog(['debug'], "Gacha token balance monitoring started successfully")
  } catch (error) {
    printLog(['error'], "Error starting Gacha token balance monitoring:", error)
    // Non-fatal error - continue without token monitoring
  }
}

// Helper function to update Gacha token balance
async function updateGachaTokenBalance(gachaTokenAddress, walletAddress) {
  try {
    const newBalance = await wsClient.readContract({
      address: gachaTokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress]
    })

    const currentEthBalance = gameState.getEthBalance()
    const oldGachaBalance = gameState.getGachaTokenBalance()
    const currentUsdc = gameState.getUsdcBalance()

    if (newBalance !== oldGachaBalance) {
      printLog(['debug'], `Gacha token balance updated: ${oldGachaBalance.toString()} -> ${newBalance.toString()}`)
      updateBalances(currentEthBalance, newBalance, currentUsdc)
    }
  } catch (error) {
    printLog(['error'], "Error updating Gacha token balance:", error)
  }
}

// Separate monitoring for USDC balance
async function startUsdcBalanceMonitoring() {
  try {
    const wallet = getLocalWallet()
    if (!wallet) {
      throw new Error("No local wallet found!")
    }

    printLog(['debug'], "Starting USDC balance monitoring for:", usdcAddress)

    // Watch for Transfer events on the USDC token contract (sent from wallet)
    const transferUnwatch = wsClient.watchContractEvent({
      address: usdcAddress,
      abi: ERC20_ABI,
      eventName: 'Transfer',
      args: {
        from: wallet.address
      },
      onLogs: async (logs) => {
        printLog(['debug'], "USDC Transfer event detected (sent), updating balance...")
        await updateUsdcBalance(wallet.address)
      },
    })

    // Watch for transfers TO the wallet
    const receiveUnwatch = wsClient.watchContractEvent({
      address: usdcAddress,
      abi: ERC20_ABI,
      eventName: 'Transfer',
      args: {
        to: wallet.address
      },
      onLogs: async (logs) => {
        printLog(['debug'], "USDC Transfer event detected (received), updating balance...")
        await updateUsdcBalance(wallet.address)
      },
    })

    usdcBalanceUnwatch = () => {
      transferUnwatch()
      receiveUnwatch()
    }

    printLog(['debug'], "USDC balance monitoring started successfully")
  } catch (error) {
    printLog(['error'], "Error starting USDC balance monitoring:", error)
  }
}

// Helper function to update USDC balance
async function updateUsdcBalance(walletAddress) {
  try {
    const newBalance = await wsClient.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress]
    })

    const currentEthBalance = gameState.getEthBalance()
    const currentGacha = gameState.getGachaTokenBalance()
    const oldUsdcBalance = gameState.getUsdcBalance()

    if (newBalance !== oldUsdcBalance) {
      printLog(['debug'], `USDC balance updated: ${oldUsdcBalance?.toString()} -> ${newBalance.toString()}`)
      updateBalances(currentEthBalance, currentGacha, newBalance)
    }
  } catch (error) {
    printLog(['error'], "Error updating USDC balance:", error)
  }
}

export function stopEventMonitoring() {
  if (eventUnwatch) {
    eventUnwatch()
    eventUnwatch = null
    printLog(['debug'], "Event monitoring stopped")
  }
  if (balancePoll) {
    clearInterval(balancePoll)
    balancePoll = null
  }
  if (gachaTokenBalanceUnwatch) {
    gachaTokenBalanceUnwatch()
    gachaTokenBalanceUnwatch = null
    printLog(['debug'], "Gacha token balance monitoring stopped")
  }
  if (usdcBalanceUnwatch) {
    usdcBalanceUnwatch()
    usdcBalanceUnwatch = null
    printLog(['debug'], "USDC balance monitoring stopped")
  }
}

async function initializeBetAmount() {
  const betAmounts = gameState.getBetAmounts()
  if (!betAmounts || betAmounts.length === 0) {
    throw new Error("Bet amounts not initialized")
  }

  gameState.setSelectedBetAmount(betAmounts[0])
}

export {
  setSelectedBetAmount,
  getMinimumPlayableBalance,
  getPlayerEthBalance,
  getPlayerGachaTokenBalance,
  getPlayerGachaTokenBalanceFormatted,
  getPlayerUsdcBalance
} from '../gameState.js'

// Debug helper functions exposed to window for manual testing
if (typeof window !== 'undefined') {
  // Revoke all stored session keys from Rise backend and clear localStorage
  window.revokeAllSessionKeys = async () => {
    const { getStoredSessionKeys, clearAllSessionKeys } = await import('./sessionKeyManager.js')
    const keys = getStoredSessionKeys()

    if (!riseWalletInstance) {
      console.log('❌ Rise Wallet not initialized')
      return 'Rise Wallet not initialized'
    }

    console.log(`🔑 Attempting to revoke ${keys.length} session keys...`)

    for (const key of keys) {
      if (key.publicKey) {
        try {
          console.log(`🔑 Revoking: ${key.publicKey.slice(0, 20)}...`)
          await riseWalletInstance.provider.request({
            method: 'wallet_revokePermissions',
            params: [{ publicKey: key.publicKey }]
          })
          console.log(`✅ Revoked successfully`)
        } catch (error) {
          console.log(`⚠️ Could not revoke (may already be revoked): ${error.message}`)
        }
      }
    }

    clearAllSessionKeys()
    console.log('🗑️ Local session keys cleared')
    return `Revoked ${keys.length} session keys. Refresh the page and reconnect wallet to create fresh session key.`
  }

  // Force create a new session key with USDC permissions
  window.forceNewUsdcSessionKey = async () => {
    if (!riseWalletInstance) {
      console.log('❌ Rise Wallet not initialized')
      return 'Rise Wallet not initialized'
    }

    const wallet = getLocalWallet()
    if (!wallet) {
      console.log('❌ No wallet connected')
      return 'No wallet connected'
    }

    // First revoke all old keys
    console.log('🔑 Step 1: Revoking all old session keys...')
    await window.revokeAllSessionKeys()

    // Reset the flag so updateSessionKeyWithUsdcPermissions will run
    sessionKeyHasUsdcPermissions = false

    // Now create new session key with USDC permissions
    console.log('🔑 Step 2: Creating new session key with USDC permissions...')
    await updateSessionKeyWithUsdcPermissions()

    // Verify the new key
    const { getStoredSessionKeys } = await import('./sessionKeyManager.js')
    const newKeys = getStoredSessionKeys()
    console.log('🔑 New session keys:', newKeys.length)
    if (newKeys.length > 0) {
      const newKey = newKeys[0]
      console.log(`✅ New key created: ${newKey.publicKey.slice(0, 20)}...`)
      console.log(`   Has USDC spend: ${newKey.permissions?.spend?.some(s => s.token && s.token !== '0x0000000000000000000000000000000000000000')}`)
    }

    return 'New session key created with USDC permissions. Try playing again.'
  }
}
