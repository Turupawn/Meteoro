/**
 * Legacy Wallet Migration
 * 
 * Handles migration from the old localStorage wallet (with private key)
 * to the new Rise Porto wallet. Transfers all GACHA tokens and ETH.
 */

import { createPublicClient, createWalletClient, webSocket, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { riseTestnet } from 'viem/chains'
import { shredActions } from 'shreds/viem'
import { printLog } from '../utils/utils.js'
import { CONTRACT_ADDRESS, WSS_URL } from './walletConfig.js'

const MIGRATION_COMPLETED_KEY = 'meteoro.legacyMigrationCompleted'
const LEGACY_WALLET_KEY = 'localWallet'

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
  }
]

// Contract ABI (minimal - just what we need)
const CONTRACT_ABI_MINIMAL = [
  {
    type: 'function',
    name: 'gachaToken',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  }
]

/**
 * Check if there's a legacy wallet with a private key that needs migration
 */
export function getLegacyWallet() {
  try {
    const walletData = localStorage.getItem(LEGACY_WALLET_KEY)
    if (!walletData) return null
    
    const wallet = JSON.parse(walletData)
    
    // Legacy wallet has a privateKey, new Rise wallet does not
    if (wallet && wallet.privateKey && wallet.address) {
      return wallet
    }
    
    return null
  } catch (error) {
    printLog(['error'], 'Error reading legacy wallet:', error)
    return null
  }
}

/**
 * Check if migration has already been completed for a specific legacy address
 */
export function isMigrationCompleted(legacyAddress) {
  try {
    const completedMigrations = localStorage.getItem(MIGRATION_COMPLETED_KEY)
    if (!completedMigrations) return false
    
    const migrations = JSON.parse(completedMigrations)
    return migrations.includes(legacyAddress.toLowerCase())
  } catch (error) {
    return false
  }
}

/**
 * Mark migration as completed for a specific legacy address
 */
function markMigrationCompleted(legacyAddress) {
  try {
    const completedMigrations = localStorage.getItem(MIGRATION_COMPLETED_KEY)
    const migrations = completedMigrations ? JSON.parse(completedMigrations) : []
    
    if (!migrations.includes(legacyAddress.toLowerCase())) {
      migrations.push(legacyAddress.toLowerCase())
      localStorage.setItem(MIGRATION_COMPLETED_KEY, JSON.stringify(migrations))
    }
  } catch (error) {
    printLog(['error'], 'Error marking migration completed:', error)
  }
}

/**
 * Check if migration is needed (has legacy wallet that hasn't been migrated)
 */
export function needsMigration() {
  const legacyWallet = getLegacyWallet()
  if (!legacyWallet) return false
  
  return !isMigrationCompleted(legacyWallet.address)
}

/**
 * Print legacy wallet credentials to console for backup purposes
 * Call this at startup so users can save their private key
 */
export function printLegacyWalletForBackup() {
  // Debug: Show what's actually in localStorage
  const localWalletRaw = localStorage.getItem(LEGACY_WALLET_KEY)
  const riseWalletRaw = localStorage.getItem('riseWallet')
  
  console.log('[Migration Debug] localStorage contents:')
  console.log('  - localWallet (legacy):', localWalletRaw)
  console.log('  - riseWallet (new):', riseWalletRaw)
  
  const legacyWallet = getLegacyWallet()
  if (legacyWallet && legacyWallet.privateKey) {
    console.log('========================================')
    console.log('⚠️  LEGACY WALLET FOUND - SAVE FOR BACKUP:')
    console.log('========================================')
    console.log('Address:', legacyWallet.address)
    console.log('Private Key:', legacyWallet.privateKey)
    console.log('========================================')
    return true
  }
  console.log('[Migration] No legacy wallet with private key found in "localWallet" key')
  return false
}

/**
 * Get the balances of the legacy wallet
 */
export async function getLegacyWalletBalances() {
  const legacyWallet = getLegacyWallet()
  if (!legacyWallet) return null

  try {
    const wsClient = createPublicClient({
      chain: riseTestnet,
      transport: webSocket(WSS_URL)
    }).extend(shredActions)

    // Get ETH balance
    const ethBalance = await wsClient.getBalance({ address: legacyWallet.address })

    // Get GachaToken address from contract
    const gachaTokenAddress = await wsClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI_MINIMAL,
      functionName: 'gachaToken',
      args: []
    })

    // Get GACHA token balance
    const gachaBalance = await wsClient.readContract({
      address: gachaTokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [legacyWallet.address]
    })

    return {
      ethBalance,
      gachaBalance,
      gachaTokenAddress,
      legacyAddress: legacyWallet.address
    }
  } catch (error) {
    printLog(['error'], 'Error getting legacy wallet balances:', error)
    return null
  }
}

/**
 * Migrate funds from legacy wallet to new Rise wallet
 * @param {string} destinationAddress - The Rise Porto wallet address to send funds to
 * @param {function} onProgress - Callback for progress updates (optional)
 * @returns {Promise<{success: boolean, ethTxHash?: string, gachaTxHash?: string, error?: string}>}
 */
export async function migrateLegacyWallet(destinationAddress, onProgress = () => {}) {
  console.log('[Migration] === STARTING MIGRATION ===')
  console.log('[Migration] Destination:', destinationAddress)
  
  const legacyWallet = getLegacyWallet()
  
  if (!legacyWallet) {
    console.log('[Migration] No legacy wallet found, aborting')
    return { success: false, error: 'No legacy wallet found' }
  }
  
  console.log('[Migration] Legacy wallet found:', legacyWallet.address)
  
  if (isMigrationCompleted(legacyWallet.address)) {
    console.log('[Migration] Migration already completed for this address')
    return { success: true, alreadyCompleted: true }
  }

  // Prevent migrating to self
  if (legacyWallet.address.toLowerCase() === destinationAddress.toLowerCase()) {
    console.log('[Migration] Source and destination are the same, aborting')
    return { success: false, error: 'Cannot migrate to the same address' }
  }

  try {
    onProgress({ status: 'initializing', message: 'Initializing migration...' })

    console.log('[Migration] Creating WebSocket client...')
    // Create clients
    const wsClient = createPublicClient({
      chain: riseTestnet,
      transport: webSocket(WSS_URL)
    }).extend(shredActions)

    console.log('[Migration] Creating wallet client from private key...')
    const account = privateKeyToAccount(legacyWallet.privateKey)
    console.log('[Migration] Account derived:', account.address)
    
    const walletClient = createWalletClient({
      account,
      chain: riseTestnet,
      transport: webSocket(WSS_URL)
    })
    console.log('[Migration] Wallet client created')

    // Get balances and token address
    onProgress({ status: 'checking', message: 'Checking balances...' })
    
    const [ethBalance, gasPrice, gachaTokenAddress] = await Promise.all([
      wsClient.getBalance({ address: legacyWallet.address }),
      wsClient.getGasPrice(),
      wsClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI_MINIMAL,
        functionName: 'gachaToken',
        args: []
      })
    ])

    const gachaBalance = await wsClient.readContract({
      address: gachaTokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [legacyWallet.address]
    })

    printLog(['debug'], 'Legacy wallet balances:', {
      ethBalance: ethBalance.toString(),
      gachaBalance: gachaBalance.toString()
    })

    const results = {
      success: true,
      ethTxHash: null,
      gachaTxHash: null,
      ethTransferred: 0n,
      gachaTransferred: 0n
    }

    // Calculate gas costs - use reasonable gas limits for transfers
    const ethTransferGasLimit = BigInt(30000) // ETH transfer (actual ~26k, buffer for safety)
    const tokenTransferGasLimit = BigInt(100000) // ERC20 transfer
    const gasCostPerTransfer = gasPrice * tokenTransferGasLimit
    const safetyBuffer = BigInt(10000000000000) // 0.00001 ETH buffer for safety (Rise chain has cheap gas)

    // Step 1: Transfer GACHA tokens (if any)
    if (gachaBalance > 0n) {
      onProgress({ status: 'transferring_gacha', message: 'Transferring GACHA tokens...' })
      
      try {
        console.log('[Migration] Preparing GACHA token transfer...')
        console.log('[Migration]   Token address:', gachaTokenAddress)
        console.log('[Migration]   Amount:', gachaBalance.toString())
        console.log('[Migration]   To:', destinationAddress)
        
        const tokenTransferRequest = await walletClient.prepareTransactionRequest({
          to: gachaTokenAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [destinationAddress, gachaBalance]
          }),
          gas: tokenTransferGasLimit
        })
        console.log('[Migration] Token transfer request prepared:', tokenTransferRequest)

        const tokenSerializedTransaction = await walletClient.signTransaction(tokenTransferRequest)
        console.log('[Migration] Token transaction signed, sending...')
        
        const tokenReceipt = await wsClient.sendRawTransactionSync({
          serializedTransaction: tokenSerializedTransaction
        })
        console.log('[Migration] Token transfer receipt:', tokenReceipt)

        results.gachaTxHash = tokenReceipt.transactionHash
        results.gachaTransferred = gachaBalance
        console.log('[Migration] ✓ GACHA transfer successful:', tokenReceipt.transactionHash)
      } catch (error) {
        console.error('[Migration] ✗ GACHA transfer failed:', error)
        console.error('[Migration] Error details:', error.message, error.cause)
        // Continue with ETH transfer even if GACHA fails
      }
    }

    // Step 2: Transfer ETH (leaving enough for gas)
    // Account for gas used by token transfer if it happened
    const ethGasCost = gasPrice * ethTransferGasLimit
    const reservedGas = gachaBalance > 0n 
      ? gasCostPerTransfer + ethGasCost + safetyBuffer  // Token + ETH transfers
      : ethGasCost + safetyBuffer  // Just ETH transfer
    
    console.log('[Migration] ETH balance:', ethBalance.toString())
    console.log('[Migration] Reserved for gas:', reservedGas.toString())
    console.log('[Migration] ETH to send:', ethBalance > reservedGas ? (ethBalance - reservedGas).toString() : '0 (not enough)')
    
    if (ethBalance > reservedGas) {
      onProgress({ status: 'transferring_eth', message: 'Transferring ETH...' })
      
      const ethToSend = ethBalance - reservedGas
      
      try {
        console.log('[Migration] Preparing ETH transfer...')
        console.log('[Migration]   Amount:', ethToSend.toString())
        console.log('[Migration]   To:', destinationAddress)
        
        const ethTransferRequest = await walletClient.prepareTransactionRequest({
          to: destinationAddress,
          value: ethToSend,
          data: '0x',
          gas: ethTransferGasLimit
        })
        console.log('[Migration] ETH transfer request prepared:', ethTransferRequest)

        const ethSerializedTransaction = await walletClient.signTransaction(ethTransferRequest)
        console.log('[Migration] ETH transaction signed, sending...')
        
        const ethReceipt = await wsClient.sendRawTransactionSync({
          serializedTransaction: ethSerializedTransaction
        })
        console.log('[Migration] ETH transfer receipt:', ethReceipt)

        results.ethTxHash = ethReceipt.transactionHash
        results.ethTransferred = ethToSend
        console.log('[Migration] ✓ ETH transfer successful:', ethReceipt.transactionHash)
      } catch (error) {
        console.error('[Migration] ✗ ETH transfer failed:', error)
        console.error('[Migration] Error details:', error.message, error.cause)
      }
    } else {
      console.log('[Migration] Skipping ETH transfer - not enough balance after gas reserve')
    }

    console.log('[Migration] === MIGRATION RESULTS ===')
    console.log('[Migration] GACHA transferred:', results.gachaTransferred?.toString() || '0')
    console.log('[Migration] GACHA tx hash:', results.gachaTxHash || 'none')
    console.log('[Migration] ETH transferred:', results.ethTransferred?.toString() || '0')
    console.log('[Migration] ETH tx hash:', results.ethTxHash || 'none')
    
    // Only mark as completed if we actually transferred something
    if (results.gachaTransferred > 0n || results.ethTransferred > 0n) {
      console.log('[Migration] Marking migration as completed...')
      markMigrationCompleted(legacyWallet.address)
      
      // Clear the private key from localStorage for security
      // Keep the address so we can show migration history
      clearLegacyWalletPrivateKey()
      console.log('[Migration] Legacy wallet private key cleared')
    } else {
      console.log('[Migration] No funds were transferred, not marking as completed')
    }

    onProgress({ status: 'completed', message: 'Migration completed!' })
    console.log('[Migration] === MIGRATION COMPLETE ===')

    return results
  } catch (error) {
    console.error('[Migration] === MIGRATION FAILED ===')
    console.error('[Migration] Error:', error)
    console.error('[Migration] Error message:', error.message)
    console.error('[Migration] Error stack:', error.stack)
    return { success: false, error: error.message }
  }
}

/**
 * Clear the private key from the legacy wallet data (for security after migration)
 */
function clearLegacyWalletPrivateKey() {
  try {
    const walletData = localStorage.getItem(LEGACY_WALLET_KEY)
    if (!walletData) return
    
    const wallet = JSON.parse(walletData)
    if (wallet && wallet.privateKey) {
      // Keep address for reference, remove private key
      const sanitizedWallet = { 
        address: wallet.address,
        migratedAt: Date.now()
      }
      localStorage.setItem(LEGACY_WALLET_KEY, JSON.stringify(sanitizedWallet))
      printLog(['debug'], 'Legacy wallet private key cleared')
    }
  } catch (error) {
    printLog(['error'], 'Error clearing legacy wallet private key:', error)
  }
}

/**
 * Format balance for display (ETH/wei to human-readable)
 */
export function formatMigrationBalance(weiBalance, decimals = 6) {
  const eth = Number(weiBalance) / 1e18
  return eth.toFixed(decimals)
}

/**
 * Perform silent migration in background (only console logs)
 * Can be called from anywhere - runs entirely in background
 * @param {string} newWalletAddress - The Rise Porto wallet address to migrate funds to
 */
export async function performSilentMigration(newWalletAddress) {
  try {
    // Log the legacy wallet private key for backup before migration
    const legacyWallet = getLegacyWallet()
    if (legacyWallet && legacyWallet.privateKey) {
      console.log('[Migration] ⚠️ LEGACY WALLET PRIVATE KEY (save this as backup):')
      console.log(`[Migration] Address: ${legacyWallet.address}`)
      console.log(`[Migration] Private Key: ${legacyWallet.privateKey}`)
      console.log('[Migration] ----------------------------------------')
    }

    console.log('[Migration] Checking legacy wallet balances...')

    const balances = await getLegacyWalletBalances()

    if (!balances) {
      console.log('[Migration] Could not read legacy wallet balances')
      return
    }

    if (balances.ethBalance === 0n && balances.gachaBalance === 0n) {
      console.log('[Migration] Legacy wallet is empty, nothing to migrate')
      return
    }

    const ethFormatted = formatMigrationBalance(balances.ethBalance)
    const gachaFormatted = formatMigrationBalance(balances.gachaBalance)

    console.log('[Migration] Legacy wallet balances:')
    console.log(`  - ETH: ${ethFormatted}`)
    console.log(`  - GACHA: ${gachaFormatted}`)
    console.log(`  - From: ${balances.legacyAddress}`)
    console.log(`  - To: ${newWalletAddress}`)

    console.log('[Migration] Starting transfer...')

    const result = await migrateLegacyWallet(newWalletAddress, (progress) => {
      console.log(`[Migration] ${progress.message}`)
    })

    if (result.success) {
      console.log('[Migration] ✓ Migration completed successfully!')
      if (result.ethTransferred > 0n) {
        console.log(`[Migration]   - ETH transferred: ${formatMigrationBalance(result.ethTransferred)}`)
        console.log(`[Migration]   - ETH tx hash: ${result.ethTxHash}`)
      }
      if (result.gachaTransferred > 0n) {
        console.log(`[Migration]   - GACHA transferred: ${formatMigrationBalance(result.gachaTransferred)}`)
        console.log(`[Migration]   - GACHA tx hash: ${result.gachaTxHash}`)
      }
    } else if (result.alreadyCompleted) {
      console.log('[Migration] Already migrated previously')
    } else {
      console.error('[Migration] Migration failed:', result.error)
    }

  } catch (error) {
    console.error('[Migration] Error during migration:', error)
  }
}

