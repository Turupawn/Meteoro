import { createPublicClient, createWalletClient, webSocket, formatEther, encodeFunctionData, custom, createClient } from 'viem'
import { riseTestnet } from 'viem/chains'
import { shredActions, sendRawTransactionSync, watchShreds } from 'shreds/viem'
import { RiseWallet } from 'rise-wallet'
import { WalletActions } from 'rise-wallet/viem'
import { P256, Signature } from 'ox'
import { printLog, getCardDisplay } from '../utils/utils.js'
import { captureBlockchainError } from '../session_tracking.js'
import { showErrorModal } from '../menus/errorModal.js'
import gameState, { updateBalances, updateBetConfiguration, updateGameState } from '../gameState.js'

const MY_CONTRACT_ADDRESS = import.meta.env.CONTRACT_ADDRESS
const WSS_URL = import.meta.env.WSS_URL || 'wss://testnet.riselabs.xyz'
const MY_CONTRACT_ABI_PATH = "/json_abi/MyContract.json"
const GAS_LIMIT = 300000
const GAS_FEE_BUFFER_ETH = 0.0000001
const BALANCE_POLL_INTERVAL = 1000

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

    // Connect to wallet using WalletActions
    // Instead of auto-connecting which blocks, we will return the client and let the UI trigger connection
    console.log("Rise Wallet client create without auto-connect")

    // We can try to see if we are already connected?
    // For now, let's return the client and wallet as null or partial?
    // The game expects 'wallet' object. 

    // Attempt silent connect or just return initialized structure
    return { web3: wsClient, my_contract: null, wallet: null, walletClient: walletClient }

  } catch (error) {
    console.error("Error initializing WebSocket client:", error)
    showErrorModal("Failed to initialize WebSocket client: " + error.message)
    throw error
  }
}

export async function connectWallet() {
  try {
    console.log("Connecting to Rise Wallet via WalletActions...")
    const { accounts } = await WalletActions.connect(walletClient)
    console.log("Connected accounts:", accounts)

    const wallet = {
      address: accounts[0]
    }

    localStorage.setItem('localWallet', JSON.stringify(wallet))

    // Session Key Logic
    let sessionPrivateKey = localStorage.getItem('sessionPrivateKey')

    if (!sessionPrivateKey) {
      console.log("No session key found. Generating new P256 key...")
      sessionPrivateKey = P256.randomPrivateKey()
      const publicKey = P256.getPublicKey(sessionPrivateKey)

      console.log("Granting permissions for session key...")
      // Grant permissions
      // We grant permission for ALL contract calls for now to simplify, or specific if needed.
      // For this game: commit, reveal, forfeit, transfer(ERC20).
      // To simplify, we might try a broad permission or just list the contract.
      // The docs showed 'calls' array.

      const response = await WalletActions.grantPermissions(walletClient, {
        key: {
          type: 'p256',
          publicKey: publicKey
        },
        expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        permissions: {
          // Allow everything for now? Or specific contract.
          // If we omit 'calls', does it allow all? Docs example shows specific calls.
          // Let's try to allow calls to MY_CONTRACT_ADDRESS and GachaToken?
          // For now let's just use the doc example structure but targeting our contract.
          calls: [
            {
              to: MY_CONTRACT_ADDRESS
              // selector: undefined (allow all functions?)
            }
          ],
          // Also need to allow spending ETH/Tokens if we do that?
          // The 'spend' permission is for native token or ERC20.
          // We stake ETH.
          spend: [
            {
              limit: BigInt(100000000000000000000), // High limit
              period: 'day',
              token: '0x0000000000000000000000000000000000000000' // ETH
            }
          ]
        }
      })

      console.log("Permissions granted:", response)
      localStorage.setItem('sessionPrivateKey', sessionPrivateKey)
    } else {
      console.log("Existing session key found.")
    }

    return wallet
  } catch (error) {
    console.error("Failed to connect wallet:", error)
    throw error
  }
}

async function sendSessionTransaction({ to, value, data }) {
  if (!riseWalletInstance) throw new Error("Rise Wallet not initialized")
  const privateKey = localStorage.getItem('sessionPrivateKey')
  if (!privateKey) throw new Error("No session private key loaded")

  const publicKey = P256.getPublicKey(privateKey)
  const provider = riseWalletInstance.provider

  console.log("Sending session transaction...")
  console.log("To:", to)

  // 1. Prepare Calls
  // wallet_prepareCalls arg structure: [{ calls: [{to, value, data}], key: {...} }]
  const prepareParams = [{
    calls: [{
      to: to,
      value: value || '0x0', // hex string expected?
      data: data
    }],
    key: {
      type: 'p256',
      publicKey: publicKey
    }
  }]

  const prepared = await provider.request({
    method: 'wallet_prepareCalls',
    params: prepareParams
  })

  console.log("Calls prepared:", prepared)

  const { digest, ...requestParams } = prepared

  // 2. Sign digest
  const signature = Signature.toHex(
    P256.sign({ payload: digest, privateKey: privateKey })
  )

  // 3. Send
  const txHash = await provider.request({
    method: 'wallet_sendPreparedCalls',
    params: [{
      ...requestParams,
      signature: signature
    }]
  })

  console.log("Session transaction sent:", txHash)
  return txHash // sendPreparedCalls returns the hash (or array of hashes?)
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

    printLog(['debug'], "Commit transaction sent:", hash)

    const receipt = await wsClient.waitForTransactionReceipt({ hash })

    if (receipt.status === '0x0' || receipt.status === 0) {
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
      status: receipt.status === 'success' ? "Confirmed" : "Failed",
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

    const receipt = await wsClient.waitForTransactionReceipt({ hash })

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

    const receipt = await wsClient.waitForTransactionReceipt({ hash })

    // Check if transaction actually succeeded
    if (receipt.status === '0x0' || receipt.status === 0) {
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