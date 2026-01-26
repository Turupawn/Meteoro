import { createPublicClient, createWalletClient, webSocket, formatEther, formatUnits, encodeFunctionData, custom, createClient } from 'viem'
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
  BALANCE_POLL_INTERVAL
} from './walletConfig.js'

import {
  getActiveSessionKey,
  isSessionKeyValid,
  createSessionKey as createNewSessionKey,
  signWithSessionKey,
  getSessionKeyTimeRemaining
} from './sessionKeyManager.js'

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

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from Rise Wallet")
    }

    const wallet = {
      address: accounts[0]
    }

    localStorage.setItem(RISE_WALLET_KEY, JSON.stringify(wallet))

    // Session Key Logic - use the new sessionKeyManager
    // Pass wallet address to ensure we get a session key for THIS wallet
    const existingSessionKey = getActiveSessionKey(wallet.address)

    if (!existingSessionKey || !isSessionKeyValid(existingSessionKey, wallet.address)) {
      console.log("🔑 No valid session key found for wallet:", wallet.address, "- Creating new one...")

      try {
        await createNewSessionKey(provider, wallet.address)
        console.log("🔑 Session key created successfully during wallet connection")
      } catch (sessionError) {
        console.warn("⚠️ Failed to create session key during connection:", sessionError.message)
        console.log("⚠️ User can still play, but will need passkey confirmation for each transaction")
        // Don't throw - wallet connection succeeded, just session key failed
      }
    } else {
      const timeRemaining = getSessionKeyTimeRemaining(existingSessionKey)
      console.log(`🔑 Existing session key found (expires in ${timeRemaining.hours}h ${timeRemaining.minutes % 60}m)`)
    }

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

async function sendSessionTransaction({ to, value, data }, retryCount = 0) {
  if (!riseWalletInstance) throw new Error("Rise Wallet not initialized")

  const provider = riseWalletInstance.provider
  const wallet = getLocalWallet()
  if (!wallet) throw new Error("No wallet connected")

  let sessionKey = getActiveSessionKey(wallet.address)
  if (!sessionKey || !isSessionKeyValid(sessionKey, wallet.address)) {
    sessionKey = await createNewSessionKey(provider, wallet.address)
  }

  const hexValue = value ? `0x${BigInt(value).toString(16)}` : '0x0'

  const prepareParams = [{
    calls: [{ to, value: hexValue, data }],
    key: { type: 'p256', publicKey: sessionKey.publicKey }
  }]

  const prepared = await provider.request({
    method: 'wallet_prepareCalls',
    params: prepareParams
  })

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
    updateBetConfiguration(betAmounts, betAmountMultipliersArray, tieRewardMultiplierValue)

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

  try {
    const txData = encodeFunctionData({
      abi: twoPartyWarGameAbi,
      functionName: 'rollDice',
      args: []
    })

    const hash = await sendSessionTransaction({
      to: MY_CONTRACT_ADDRESS,
      value: betAmount,
      data: txData
    })

    return { transactionHash: hash, status: 'success' }
  } catch (error) {
    printLog(['error'], "rollDice error:", error)
    showErrorModal("Failed to roll dice: " + error.message)
    captureBlockchainError(error, 'rollDice', {
      error_type: 'transaction_failed',
      transaction_data: {
        to: MY_CONTRACT_ADDRESS,
        value: gameState.getSelectedBetAmount()?.toString(),
        gas: GAS_LIMIT
      }
    })
    throw error
  }
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

      const tokenHash = await walletClient.sendTransaction({
        to: gachaTokenAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [destinationAddress, gachaTokenBalance]
        }),
        gas: BigInt(GAS_LIMIT)
      })

      printLog(['debug'], "Gacha token transfer transaction sent:", tokenHash)
      receipts.push(tokenHash)

      printLog(['debug'], "Gacha token transfer transaction sent (Legacy Log):", tokenHash)
    }

    // Then transfer ETH
    const valueToSend = currentBalance;

    if (valueToSend > 0n) {
      printLog(['debug'], "Transferring ETH:", valueToSend.toString(), "to", destinationAddress)

      const ethHash = await walletClient.sendTransaction({
        to: destinationAddress,
        value: valueToSend,
        data: '0x',
        gas: BigInt(GAS_LIMIT)
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

    // Watch for GameCompleted events
    const unwatch = wsClient.watchContractEvent({
      address: MY_CONTRACT_ADDRESS,
      abi: twoPartyWarGameAbi,
      eventName: 'GameCompleted',
      args: {
        player: wallet.address
      },
      onLogs: async (logs) => {
        printLog(['debug'], "🔔 GameCompleted event received! Logs:", logs?.length || 0)
        try {
          const freshState = await checkGameState()
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
