import { createPublicClient, createWalletClient, webSocket, formatEther, encodeFunctionData } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { riseTestnet } from 'viem/chains'
import { shredActions, sendRawTransactionSync, watchShreds } from 'shreds/viem'
import { printLog, getCardDisplay } from '../utils/utils.js'
import { captureBlockchainError } from '../session_tracking.js'
import { showErrorModal } from '../menus/errorModal.js'
import gameState, { updateBalances, updateBetConfiguration, updateGameState } from '../gameState.js'

const MY_CONTRACT_ADDRESS = import.meta.env.CONTRACT_ADDRESS
const WSS_URL = import.meta.env.WSS_URL || 'wss://testnet.riselabs.xyz'
const MY_CONTRACT_ABI_PATH = "/json_abi/MyContract.json"
const GAS_LIMIT = 300000
const GAS_FEE_BUFFER_ETH = 0.00001
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
    wsClient = createPublicClient({
      chain: riseTestnet,
      transport: webSocket(WSS_URL)
    }).extend(shredActions)
    
    // Get or create wallet
    let wallet = getLocalWallet()
    if (!wallet) {
      console.log("Generating new wallet...")
      const pk = generatePrivateKey()
      const account = privateKeyToAccount(pk)
      wallet = {
        address: account.address,
        privateKey: pk
      }
      localStorage.setItem('localWallet', JSON.stringify(wallet))
    }

    walletClient = createWalletClient({
      account: privateKeyToAccount(wallet.privateKey),
      chain: riseTestnet,
      transport: webSocket(WSS_URL)
    })
    
    printLog(['debug'], "WebSocket client initialized successfully")
    printLog(['debug'], "Wallet address:", wallet.address)
    
    return { web3: wsClient, my_contract: null, wallet }
  } catch (error) {
    console.error("Error initializing WebSocket client:", error)
    showErrorModal("Failed to initialize WebSocket client: " + error.message)
    throw error
  }
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
    
    const request = await walletClient.prepareTransactionRequest({
      to: MY_CONTRACT_ADDRESS,
      value: gameState.getSelectedBetAmount(),
      data: encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'commit',
        args: [commitHash]
      }),
      gas: BigInt(GAS_LIMIT)
    })
    
    // Sign the transaction
    const serializedTransaction = await walletClient.signTransaction(request)
    
    // Use sendRawTransactionSync with signed transaction
    const receipt = await wsClient.sendRawTransactionSync({
      serializedTransaction
    })
    
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

    // Compute gas cost and a small safety buffer
    // We need enough ETH for both token transfer (if needed) and ETH transfer
    const gasLimit = BigInt(GAS_LIMIT)
    const gasCost = gasPrice * gasLimit
    const safetyBufferWei = BigInt(Math.floor(GAS_FEE_BUFFER_ETH * 1e18))
    // Reserve gas for token transfer (if tokens exist) + ETH transfer
    const totalGasReserve = gachaTokenBalance > 0n 
      ? (gasCost * 2n) + safetyBufferWei 
      : gasCost + safetyBufferWei

    if (currentBalance <= totalGasReserve) {
      throw new Error("Insufficient balance to cover gas for withdrawal")
    }

    const receipts = []

    // First, transfer Gacha tokens if user has any
    if (gachaTokenBalance > 0n) {
      printLog(['debug'], "Transferring Gacha tokens:", gachaTokenBalance.toString(), "to", destinationAddress)
      
      const tokenTransferRequest = await walletClient.prepareTransactionRequest({
        to: gachaTokenAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [destinationAddress, gachaTokenBalance]
        }),
        gas: gasLimit
      })

      const tokenSerializedTransaction = await walletClient.signTransaction(tokenTransferRequest)
      const tokenReceipt = await wsClient.sendRawTransactionSync({
        serializedTransaction: tokenSerializedTransaction
      })

      printLog(['debug'], "Gacha token transfer transaction sent:", tokenReceipt.transactionHash)
      receipts.push(tokenReceipt.transactionHash)
    }

    // Then transfer ETH (after reserving gas for token transfer if it happened)
    const ethGasReserve = gachaTokenBalance > 0n 
      ? (gasCost * 2n) + safetyBufferWei 
      : gasCost + safetyBufferWei
    
    const valueToSend = currentBalance > ethGasReserve 
      ? currentBalance - ethGasReserve 
      : 0n

    if (valueToSend > 0n) {
      printLog(['debug'], "Transferring ETH:", valueToSend.toString(), "to", destinationAddress)
      
      const ethTransferRequest = await walletClient.prepareTransactionRequest({
        to: destinationAddress,
        value: valueToSend,
        data: '0x',
        gas: gasLimit
      })

      const ethSerializedTransaction = await walletClient.signTransaction(ethTransferRequest)
      const ethReceipt = await wsClient.sendRawTransactionSync({
        serializedTransaction: ethSerializedTransaction
      })

      printLog(['debug'], "ETH transfer transaction sent:", ethReceipt.transactionHash)
      receipts.push(ethReceipt.transactionHash)
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
    const request = await walletClient.prepareTransactionRequest({
      to: MY_CONTRACT_ADDRESS,
      value: 0n,
      data: encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'forfeit',
        args: []
      }),
      gas: BigInt(GAS_LIMIT)
    })
    
    // Sign the transaction
    const serializedTransaction = await walletClient.signTransaction(request)
    
    // Use sendRawTransactionSync with signed transaction
    const receipt = await wsClient.sendRawTransactionSync({
      serializedTransaction
    })
    
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
    const request = await walletClient.prepareTransactionRequest({
      to: MY_CONTRACT_ADDRESS,
      value: 0n,
      data: encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'reveal',
        args: [secret]
      }),
      gas: BigInt(GAS_LIMIT)
    })
    
    // Sign the transaction
    const serializedTransaction = await walletClient.signTransaction(request)
    
    // Use sendRawTransactionSync with signed transaction
    const receipt = await wsClient.sendRawTransactionSync({
      serializedTransaction
    })
    
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

    // Additionally, use watchShreds for real-time updates via state changes
    const shredsUnwatch = watchShreds(wsClient, {
      onShred: async (shred) => {
        // Check if this shred affects our wallet address or the token contract
        const walletLower = wallet.address.toLowerCase()
        let shouldUpdate = false

        // Check state changes for address balance updates
        if (shred.stateChanges) {
          for (const stateChange of shred.stateChanges) {
            const address = stateChange.address?.toLowerCase()
            // If the shred affects our wallet or the token contract, update balance
            if (address === walletLower || address === gachaTokenAddress.toLowerCase()) {
              shouldUpdate = true
              break
            }
          }
        }

        if (shouldUpdate) {
          printLog(['debug'], "Shred detected affecting wallet or token contract, updating Gacha balance...")
          await updateGachaTokenBalance(gachaTokenAddress, wallet.address)
        }
      },
      onError: (error) => {
        printLog(['error'], "Shred watching error for Gacha token:", error)
      }
    })

    // Combine both unwatch functions
    const originalUnwatch = gachaTokenBalanceUnwatch
    gachaTokenBalanceUnwatch = () => {
      originalUnwatch()
      shredsUnwatch()
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