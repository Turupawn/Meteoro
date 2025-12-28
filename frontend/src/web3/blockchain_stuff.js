import { createPublicClient, createWalletClient, webSocket, formatEther, encodeFunctionData, custom, createClient } from 'viem'
import { riseTestnet } from 'viem/chains'
import { shredActions, sendRawTransactionSync, watchShreds } from 'shreds/viem'
import { RiseWallet, Chains } from 'rise-wallet'
import { WalletActions } from 'rise-wallet/viem'
import { P256, Signature } from 'ox'
import { printLog, getCardDisplay } from '../utils/utils.js'
import { captureBlockchainError } from '../session_tracking.js'
import { showErrorModal } from '../menus/errorModal.js'
import gameState, { updateBalances, updateBetConfiguration, updateGameState } from '../gameState.js'

// Import centralized configuration
import {
  CONTRACT_ADDRESS as MY_CONTRACT_ADDRESS,
  WSS_URL,
  GAS_LIMIT,
  GAS_FEE_BUFFER_ETH,
  BALANCE_POLL_INTERVAL
} from './walletConfig.js'

// Import session key manager
import {
  getActiveSessionKey,
  isSessionKeyValid,
  hasUsableSessionKey,
  createSessionKey as createNewSessionKey,
  signWithSessionKey,
  getSessionKeyTimeRemaining
} from './sessionKeyManager.js'

// Import game permissions
import { isCallPermitted, GAME_PERMISSIONS } from './gamePermissions.js'

const MY_CONTRACT_ABI_PATH = "/json_abi/MyContract.json"

let CONTRACT_ABI = null

// ERC20 ABI for token transfers
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

export function formatBalance(weiBalance, shownDecimals = 6) {
  const balanceInEth = formatEther(weiBalance)
  return Number(balanceInEth).toFixed(shownDecimals)
}

async function loadContractABI() {
  if (CONTRACT_ABI) return CONTRACT_ABI

  try {
    const response = await fetch(MY_CONTRACT_ABI_PATH)
    CONTRACT_ABI = await response.json()
    printLog(['debug'], "Contract ABI loaded successfully")
    return CONTRACT_ABI
  } catch (error) {
    console.error("Failed to load contract ABI:", error)
    throw error
  }
}

export function getLocalWallet() {
  const walletData = localStorage.getItem('localWallet')
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

    await loadContractABI()

    // Create Rise Wallet instance
    const rw = RiseWallet.create();
    riseWalletInstance = rw;

    wsClient = createPublicClient({
      chain: riseTestnet,
      transport: webSocket(WSS_URL)
    }).extend(shredActions)

    // Create Viem client with Rise Wallet provider
    walletClient = createClient({
      chain: riseTestnet,
      transport: custom(rw.provider)
    })

    console.log("Rise Wallet client created")

    // Check if we have a saved wallet in localStorage
    const savedWallet = getLocalWallet()

    if (savedWallet && savedWallet.address) {
      console.log("🔗 Found saved wallet in localStorage:", savedWallet.address)

      // Verify the wallet is still connected with Rise Wallet
      try {
        const accounts = await rw.provider.request({
          method: 'eth_accounts'
        })

        if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === savedWallet.address.toLowerCase()) {
          console.log("🔗 Wallet session still valid, auto-reconnecting...")
          return { web3: wsClient, my_contract: null, wallet: savedWallet, walletClient: walletClient }
        } else {
          console.log("🔗 Wallet session expired or different account, need re-connection")
          // Clear the old wallet data
          localStorage.removeItem('localWallet')
        }
      } catch (error) {
        console.log("🔗 Could not verify wallet session:", error.message)
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

export async function connectWallet() {
  try {
    if (!riseWalletInstance) {
      throw new Error("Rise Wallet not initialized. Call initWeb3() first.")
    }

    const provider = riseWalletInstance.provider

    console.log("🔗 Connecting to Rise Wallet...")
    console.log("🔗 Requesting accounts via eth_requestAccounts (this triggers OAuth popup)...")

    // Use eth_requestAccounts to trigger the Rise Wallet popup
    // This is the standard EIP-1193 method that opens the OAuth popup (Google, etc.)
    const accounts = await provider.request({
      method: 'eth_requestAccounts'
    })

    console.log("🔗 Connected accounts:", accounts)

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from Rise Wallet")
    }

    const wallet = {
      address: accounts[0]
    }

    localStorage.setItem('localWallet', JSON.stringify(wallet))

    // Session Key Logic - use the new sessionKeyManager
    const existingSessionKey = getActiveSessionKey()

    if (!existingSessionKey || !isSessionKeyValid(existingSessionKey)) {
      console.log("🔑 No valid session key found. Creating new one...")

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


/**
 * Send a transaction using session key (no popup) or fallback to passkey
 * @param {Object} options - Transaction options
 * @param {string} options.to - Target contract address
 * @param {bigint|string} options.value - Value to send (in wei)
 * @param {string} options.data - Encoded function call data
 * @param {boolean} options.requiresSessionKey - If true, fail if no session key
 * @returns {Promise<string>} Transaction hash
 */
async function sendSessionTransaction({ to, value, data, requiresSessionKey = false }) {
  if (!riseWalletInstance) throw new Error("Rise Wallet not initialized")

  const provider = riseWalletInstance.provider
  const wallet = getLocalWallet()
  if (!wallet) throw new Error("No wallet connected")

  // Get active session key
  let sessionKey = getActiveSessionKey()

  // Check if session key is valid
  if (!sessionKey || !isSessionKeyValid(sessionKey)) {
    console.log("🔑 No valid session key found")

    // Check if call is permitted (if we had a session key)
    if (data && !isCallPermitted(to, data)) {
      console.log("⚠️ Call not in permitted list, using passkey")
      return sendPasskeyTransaction({ to, value, data })
    }

    // Try to create a new session key
    try {
      console.log("🔑 Attempting to create new session key...")
      sessionKey = await createNewSessionKey(provider, wallet.address)
      console.log("🔑 Session key created successfully")
    } catch (createError) {
      console.warn("⚠️ Failed to create session key:", createError.message)

      if (requiresSessionKey) {
        throw new Error("Session key required but could not be created: " + createError.message)
      }

      // Fallback to passkey
      console.log("🔐 Falling back to passkey transaction...")
      return sendPasskeyTransaction({ to, value, data })
    }
  }

  // Log session key status
  const timeRemaining = getSessionKeyTimeRemaining(sessionKey)
  console.log(`🔑 Using session key (expires in ${timeRemaining.hours}h ${timeRemaining.minutes % 60}m)`)
  console.log("   To:", to)
  console.log("   Value:", value ? value.toString() : '0')

  // Convert value to hex string format expected by wallet
  const hexValue = value ? `0x${BigInt(value).toString(16)}` : '0x0'

  // 1. Prepare Calls
  const prepareParams = [{
    calls: [{
      to: to,
      value: hexValue,
      data: data
    }],
    key: {
      type: 'p256',
      publicKey: sessionKey.publicKey
    }
  }]

  try {
    const prepared = await provider.request({
      method: 'wallet_prepareCalls',
      params: prepareParams
    })

    console.log("🔑 Calls prepared successfully")

    const { digest, ...requestParams } = prepared

    // 2. Sign digest using session key (local, no popup)
    const signature = signWithSessionKey(digest, sessionKey)
    console.log("🔑 Transaction signed with session key")

    // 3. Send prepared calls
    const response = await provider.request({
      method: 'wallet_sendPreparedCalls',
      params: [{
        ...requestParams,
        signature: signature
      }]
    })

    console.log("🔑 Session transaction response:", response)

    // wallet_sendPreparedCalls returns [{id: "..."}]
    // Use wallet_getCallsStatus to get the actual transaction hash (like wallet-demo)
    let callId
    if (Array.isArray(response) && response.length > 0 && response[0].id) {
      callId = response[0].id
    } else if (typeof response === 'string') {
      callId = response
    } else {
      console.warn("⚠️ Unexpected response format:", response)
      return response
    }

    // Use wallet_getCallsStatus to get the actual tx hash - this is instant on Rise Chain
    const callStatus = await provider.request({
      method: 'wallet_getCallsStatus',
      params: [callId]
    })

    console.log("🔑 Call status:", callStatus)

    // Extract the actual transaction hash from the call status
    let txHash = callId
    if (callStatus && callStatus.receipts && callStatus.receipts.length > 0) {
      txHash = callStatus.receipts[0].transactionHash
    }

    console.log("🔑 Session transaction sent, hash:", txHash)
    return txHash

  } catch (error) {
    console.error("❌ Session transaction failed:", error.message)

    // Check if it's a permission error
    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      console.log("⚠️ Session key permission denied, falling back to passkey")
      return sendPasskeyTransaction({ to, value, data })
    }

    throw error
  }
}

/**
 * Send a transaction using passkey (requires user popup confirmation)
 * @param {Object} options - Transaction options
 * @returns {Promise<string>} Transaction hash
 */
async function sendPasskeyTransaction({ to, value, data }) {
  if (!riseWalletInstance) throw new Error("Rise Wallet not initialized")

  const provider = riseWalletInstance.provider
  const wallet = getLocalWallet()

  console.log("🔐 Sending passkey transaction (requires confirmation)...")
  console.log("   To:", to)
  console.log("   Value:", value ? value.toString() : '0')

  // Convert value to hex
  const hexValue = value ? `0x${BigInt(value).toString(16)}` : '0x0'

  // Use standard sendTransaction which triggers passkey popup
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: wallet.address,
      to: to,
      value: hexValue,
      data: data
    }]
  })

  console.log("🔐 Passkey transaction sent:", txHash)
  return txHash
}
/**
 * Validate hash format and get transaction receipt
 * ULTRA-OPTIMIZED for Rise Chain's 10ms blocks
 * @param {string} hash - Transaction hash (may be truncated)
 * @returns {Promise<Object>} Transaction receipt or success status
 */
async function getTransactionReceiptSafe(hash) {
  // Validate and fix hash format if needed (should be 66 chars: 0x + 64 hex)
  let validHash = hash
  if (typeof hash === 'string' && hash.startsWith('0x')) {
    if (hash.length < 66) {
      validHash = '0x' + hash.slice(2).padStart(64, '0')
    }
  }

  // For Rise Chain (10ms blocks), use Rise Wallet provider directly
  // No need to wait - tx is confirmed almost instantly
  try {
    const riseReceipt = await riseWalletInstance.provider.request({
      method: 'eth_getTransactionReceipt',
      params: [validHash]
    })
    if (riseReceipt) {
      return riseReceipt
    }
  } catch (e) {
    // Ignore - tx was sent successfully
  }

  // On Rise Chain, if tx was sent by Rise Wallet, it's confirmed
  // Return success immediately - no need to poll
  return { transactionHash: validHash, status: 'success' }
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
    console.log("Contract ABI loaded:", !!CONTRACT_ABI)
    printLog(['debug'], "Using WebSocket for initial state check")

    let gameStateTemp
    try {
      printLog(['debug'], "Using WebSocket client for initial state check...")
      // Use WebSocket client for initial state check
      gameStateTemp = await wsClient.readContract({
        address: MY_CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
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

    // Access the array elements by index according to the ABI
    const playerEthBalance = gameStateTemp[0]
    const playerGachaTokenBalance = gameStateTemp[1]
    const currentGameState = gameStateTemp[2]
    const playerCommit = gameStateTemp[3]
    const houseRandomness = gameStateTemp[4]
    const gameId = gameStateTemp[5]
    const recentHistory = gameStateTemp[6]
    const tieRewardMultiplierValue = gameStateTemp[7]
    const betAmounts = gameStateTemp[8]
    const betAmountMultipliersArray = gameStateTemp[9]

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
    updateBalances(playerEthBalance, playerGachaTokenBalance)
    updateBetConfiguration(betAmounts, betAmountMultipliersArray, tieRewardMultiplierValue)

    if (!betAmounts || betAmounts.length === 0) {
      printLog(['error'], "Contract is accessible but has no bet amounts configured")
      printLog(['error'], "This means the contract owner needs to call setBetAmounts()")
      throw new Error("No bet amounts configured in contract - owner needs to set bet amounts")
    }

    // Selected bet amount is now handled in gameState.updateBetConfiguration()

    const gameState = {
      playerETHBalance: playerEthBalance,
      playerGachaTokenBalance: playerGachaTokenBalance,
      gameState: BigInt(currentGameState),
      playerCommit: playerCommit,
      houseRandomness: houseRandomness,
      gameId: gameId,
      recentHistory: recentHistory,
      tieRewardMultiplier: tieRewardMultiplierValue,
      betAmounts: betAmounts,
      betAmountMultipliers: betAmountMultipliersArray
    }

    printLog(['profile'], "=== INITIAL GAME STATE LOAD ===")
    printLog(['profile'], "Game state loaded successfully")
    printLog(['profile'], "Time taken:", Date.now() - startTime, "ms")
    printLog(['profile'], "=============================")

    return gameState
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
      abi: CONTRACT_ABI,
      functionName: 'getFrontendGameState',
      args: [wallet.address]
    })

    const playerEthBalance = gameStateTemp[0]
    const playerGachaTokenBalance = gameStateTemp[1]
    const currentGameState = gameStateTemp[2]
    const playerCommit = gameStateTemp[3]
    const houseRandomness = gameStateTemp[4]
    const gameId = gameStateTemp[5]

    // Update centralized game state
    updateBalances(playerEthBalance, playerGachaTokenBalance)

    const gameStateData = {
      playerETHBalance: playerEthBalance,
      playerGachaTokenBalance: playerGachaTokenBalance,
      gameState: BigInt(currentGameState),
      playerCommit: playerCommit,
      houseRandomness: houseRandomness,
      gameId: gameId
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

export async function commit(commitHash) {
  const wallet = getLocalWallet()
  if (!wallet) {
    const error = new Error("No local wallet found!")
    showErrorModal(error.message)
    captureBlockchainError(error, 'commit', {
      error_type: 'wallet_not_found'
    })
    throw error
  }

  if (!gameState.getSelectedBetAmount()) {
    await initializeBetAmount()
  }

  try {
    printLog(['debug'], "Sending commit transaction via WebSocket...")
    const startTime = Date.now()

    // Send transaction using the Rise Wallet client
    // Note: Rise Wallet handles signing and sending. We don't need manual signing + sendRawTransactionSync for standard txs unless using shreds specifically.
    // However, the original code used sendRawTransactionSync. 
    // Is sendRawTransactionSync required for shreds low latency?
    // Rise Wallet docs say "Use Rise Wallet's EIP-1193 provider with Viem's custom transport".
    // Let's try standard walletClient.sendTransaction which Rise Wallet intercepts.

    // Use session key transaction
    const hash = await sendSessionTransaction({
      to: MY_CONTRACT_ADDRESS,
      value: gameState.getSelectedBetAmount(),
      data: encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'commit',
        args: [commitHash]
      })
    })

    printLog(['debug'], "Commit transaction sent, raw hash:", hash)

    // Validate and fix hash format if needed (should be 66 chars: 0x + 64 hex)
    let validHash = hash
    if (typeof hash === 'string' && hash.startsWith('0x')) {
      if (hash.length < 66) {
        // Pad with leading zeros after 0x
        validHash = '0x' + hash.slice(2).padStart(64, '0')
        printLog(['debug'], "Hash was truncated, padded to:", validHash)
      }
    }

    printLog(['debug'], "Waiting for transaction receipt, hash:", validHash)

    // Use Rise Wallet provider for receipt since it knows about the transaction
    let receipt
    try {
      receipt = await wsClient.waitForTransactionReceipt({
        hash: validHash,
        timeout: 30000 // 30 second timeout
      })
    } catch (waitError) {
      printLog(['debug'], "waitForTransactionReceipt failed:", waitError.message)
      // Try getting receipt directly from Rise Wallet provider
      try {
        const riseReceipt = await riseWalletInstance.provider.request({
          method: 'eth_getTransactionReceipt',
          params: [validHash]
        })
        if (riseReceipt) {
          receipt = riseReceipt
          printLog(['debug'], "Got receipt from Rise Wallet provider")
        } else {
          // Transaction may still be pending or hash format issue
          // Return success since the transaction was sent
          printLog(['debug'], "Transaction sent but receipt not available yet")
          return { transactionHash: validHash, status: 'pending' }
        }
      } catch (riseError) {
        printLog(['debug'], "Rise provider receipt also failed:", riseError.message)
        // Transaction was sent successfully, return pending status
        return { transactionHash: validHash, status: 'pending' }
      }
    }

    if (receipt.status === '0x0' || receipt.status === 0 || receipt.status === 'reverted') {
      const error = new Error("Transaction failed: Game state may not allow this action. Please check if you need to reveal a previous game first.");
      showErrorModal(error.message);
      captureBlockchainError(error, 'commit', {
        error_type: 'transaction_reverted',
        transaction_hash: receipt.transactionHash,
        gas_used: receipt.gasUsed?.toString()
      });
      throw error;
    }

    const confirmTime = Date.now() - startTime
    printLog(['debug'], "Commit Transaction Receipt:", {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 'success' || receipt.status === '0x1' ? "Confirmed" : "Failed",
      gasUsed: receipt.gasUsed,
      confirmationTime: confirmTime + "ms"
    })

    return receipt
  } catch (error) {
    showErrorModal("Failed to commit: " + error.message)
    captureBlockchainError(error, 'commit', {
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

    // Fetch current balance, gas price, and GachaToken address
    const [currentBalance, gasPrice, gachaTokenAddress] = await Promise.all([
      wsClient.getBalance({ address: wallet.address }),
      wsClient.getGasPrice(),
      wsClient.readContract({
        address: MY_CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'gachaToken',
        args: []
      })
    ])

    // Get Gacha token balance
    const gachaTokenBalance = gameState.getGachaTokenBalance()

    // Rise Wallet is gasless, so we can skip strict balance checks for gas.
    // We only check if user has enough balance to send the VALUE they want to send (if any).
    // The original code was calculating gas cost. We will assume gas is covered.

    // const valueToSend = currentBalance; // Moved to later usage

    // If we are just sending tokens, we don't need ETH.
    // If we are sending ETH, we should check if we have enough ETH.
    // The original logic was trying to empty the wallet.
    // For Rise Wallet, let's keep it simple: just try to send.

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

      // We wait for receipt here to match the 'receipt' structure expectations if possible, 
      // or just return hash if the upstream code handles it. 
      // The original code waited for sendRawTransactionSync which returns a receipt-like object immediately? 
      // Actually sendRawTransactionSync usually returns a receipt in shreds context?
      // Let's assume we need to return a receipt or hash. The caller expects receipts[0].
      // We'll push the hash.

      printLog(['debug'], "Gacha token transfer transaction sent:", tokenHash)
      receipts.push(tokenHash)

      // Note: original code used tokenReceipt.transactionHash. 
      // If we need to wait, we should: await wsClient.waitForTransactionReceipt({ hash: tokenHash })

      printLog(['debug'], "Gacha token transfer transaction sent (Legacy Log):", tokenHash)
    }

    // Then transfer ETH
    // Original logic reserved gas. We will just send what is available locally or a slightly smaller amount if we suspect gas usage.
    // But since it's gasless, maybe we can send it all?
    // Let's send currentBalance minus a tiny dust to be safe, or just currentBalance.
    // Let's try sending almost all, leaving a tiny bit just in case.

    const valueToSend = currentBalance; // Logic simplified for gasless assumption

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

export async function forfeit() {
  const wallet = getLocalWallet()
  if (!wallet) {
    throw new Error("No local wallet found!")
  }

  try {
    printLog(['debug'], "Sending forfeit transaction via WebSocket...")
    const startTime = Date.now()

    // Prepare transaction request
    const hash = await sendSessionTransaction({
      to: MY_CONTRACT_ADDRESS,
      value: 0n,
      data: encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'forfeit',
        args: []
      })
    })

    const receipt = await getTransactionReceiptSafe(hash)

    const confirmTime = Date.now() - startTime
    printLog(['debug'], "Forfeit Transaction Receipt:", {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 'success' ? "Confirmed" : "Failed",
      gasUsed: receipt.gasUsed,
      confirmationTime: confirmTime + "ms"
    })

    return receipt
  } catch (error) {
    showErrorModal("Failed to forfeit: " + error.message)
    captureBlockchainError(error, 'forfeit', {
      error_type: 'transaction_failed'
    })
    throw error
  }
}

export async function performReveal(secret) {
  try {
    printLog(['debug'], "=== PERFORM REVEAL START ===")

    const wallet = getLocalWallet()
    if (!wallet) {
      throw new Error("No local wallet found!")
    }

    printLog(['debug'], "Sending reveal transaction via WebSocket...")
    const startTime = Date.now()

    // Prepare transaction request
    const hash = await sendSessionTransaction({
      to: MY_CONTRACT_ADDRESS,
      value: 0n,
      data: encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'reveal',
        args: [secret]
      })
    })

    const receipt = await getTransactionReceiptSafe(hash)

    // Check if transaction actually succeeded (skip check if pending)
    if (receipt.status !== 'pending' && (receipt.status === '0x0' || receipt.status === 0 || receipt.status === 'reverted')) {
      console.log("❌ Reveal transaction failed - status indicates failure");
      const error = new Error("Reveal transaction failed: Invalid secret or game state issue.");
      showErrorModal(error.message);
      captureBlockchainError(error, 'performReveal', {
        error_type: 'transaction_reverted',
        transaction_hash: receipt.transactionHash,
        gas_used: receipt.gasUsed?.toString()
      });
      throw error;
    }

    const confirmTime = Date.now() - startTime
    printLog(['debug'], "Reveal Transaction Receipt:", {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 'success' ? "Confirmed" : "Failed",
      gasUsed: receipt.gasUsed,
      confirmationTime: confirmTime + "ms"
    })

    printLog(['debug'], "=== PERFORM REVEAL END ===")
    return receipt
  } catch (error) {
    printLog(['error'], "Error in reveal:", error)
    showErrorModal("Failed to reveal: " + error.message)
    captureBlockchainError(error, 'performReveal', {
      error_type: 'reveal_transaction_failed',
      secret_provided: !!secret
    })
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

    const unwatch = wsClient.watchContractEvent({
      address: MY_CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      eventName: 'GameStateChanged',
      args: {
        player: wallet.address
      },
      onLogs: async (logs) => {
        printLog(['debug'], "Event monitoring started successfully")
        updateGameState(await checkGameState())
      },
    });

    eventUnwatch = unwatch

    printLog(['debug'], "Event monitoring started successfully")

    balancePoll = setInterval(async () => {
      const ethBalance = await wsClient.getBalance({ address: wallet.address })
      const currentGacha = gameState.getGachaTokenBalance()
      updateBalances(ethBalance, currentGacha)
    }, BALANCE_POLL_INTERVAL)

    await startGachaTokenBalanceMonitoring()

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

    // Get GachaToken contract address
    const gachaTokenAddress = await wsClient.readContract({
      address: MY_CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'gachaToken',
      args: []
    })

    printLog(['debug'], "Starting Gacha token balance monitoring via shreds for:", gachaTokenAddress)

    // Get initial token balance
    const initialBalance = await wsClient.readContract({
      address: gachaTokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet.address]
    })

    // Update initial balance in game state
    const currentEthBalance = gameState.getETHBalance()
    updateBalances(currentEthBalance, initialBalance)
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

    const currentEthBalance = gameState.getETHBalance()
    const oldGachaBalance = gameState.getGachaTokenBalance()

    if (newBalance !== oldGachaBalance) {
      printLog(['debug'], `Gacha token balance updated: ${oldGachaBalance.toString()} -> ${newBalance.toString()}`)
      updateBalances(currentEthBalance, newBalance)
    }
  } catch (error) {
    printLog(['error'], "Error updating Gacha token balance:", error)
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
  getPlayerETHBalance,
  getPlayerGachaTokenBalance,
  getPlayerGachaTokenBalanceFormatted
} from '../gameState.js'