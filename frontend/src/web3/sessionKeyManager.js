/**
 * Session Key Manager
 * Handles creation, validation, and management of Rise Wallet session keys
 * Based on patterns from wallet-demo but adapted for vanilla JavaScript
 */

import { P256, Signature, PublicKey } from 'ox'
import { SESSION_KEY_STORAGE_PREFIX, SESSION_KEY_EXPIRY_SECONDS } from './walletConfig.js'
import { GAME_PERMISSIONS } from './gamePermissions.js'

// Module-level storage for active session key
let activeKeyPair = null

/**
 * Storage key for a specific public key
 */
function getStorageKey(publicKey) {
    return `${SESSION_KEY_STORAGE_PREFIX}.${publicKey}`
}

/**
 * Get all stored session keys from localStorage
 * @returns {Array} Array of stored session key data
 */
export function getStoredSessionKeys() {
    if (typeof window === 'undefined') return []

    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(SESSION_KEY_STORAGE_PREFIX)) {
            try {
                const data = JSON.parse(localStorage.getItem(key))
                if (data && data.publicKey) {
                    keys.push(data)
                }
            } catch (e) {
                console.warn('Failed to parse session key:', key, e)
            }
        }
    }
    return keys
}

/**
 * Get the active session key pair (if any)
 * @returns {Object|null} Key pair object with privateKey and publicKey, or null
 */
export function getActiveSessionKey() {
    // First check module-level cache
    if (activeKeyPair && isSessionKeyValid(activeKeyPair)) {
        return activeKeyPair
    }

    // Try to restore from localStorage
    const storedKeys = getStoredSessionKeys()
    const validKey = storedKeys.find(key => isSessionKeyValid(key))

    if (validKey) {
        activeKeyPair = validKey
        return validKey
    }

    return null
}

/**
 * Check if a session key is still valid (not expired)
 * @param {Object} sessionKey - Session key data object
 * @returns {boolean} True if valid and not expired
 */
export function isSessionKeyValid(sessionKey) {
    if (!sessionKey || !sessionKey.publicKey || !sessionKey.privateKey) {
        return false
    }

    if (!sessionKey.expiry) {
        return false
    }

    const now = Math.floor(Date.now() / 1000)
    return sessionKey.expiry > now
}

/**
 * Check if we have a usable session key
 * @returns {boolean} True if a valid session key exists
 */
export function hasUsableSessionKey() {
    return getActiveSessionKey() !== null
}

/**
 * Create a new session key and request permissions from Rise Wallet
 * @param {Object} provider - Rise Wallet EIP-1193 provider
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<Object>} Created session key data
 */
export async function createSessionKey(provider, walletAddress) {
    console.log('🔑 Creating new session key...')

    try {
        // Generate P256 key pair
        const privateKey = P256.randomPrivateKey()
        const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), {
            includePrefix: false
        })

        console.log('🔑 Generated P256 key pair')
        console.log('   Public key:', publicKey.slice(0, 20) + '...')

        // Calculate expiry (24 hours from now)
        const expiry = Math.floor(Date.now() / 1000) + SESSION_KEY_EXPIRY_SECONDS

        // Request permissions from Rise Wallet
        // Note: Rise Wallet 0.3.0 requires feeToken object
        const permissionParams = [{
            key: {
                type: 'p256',
                publicKey: publicKey
            },
            expiry: expiry,
            permissions: GAME_PERMISSIONS,
            // feeToken specifies which token to use for gas fees and limit
            feeToken: {
                token: '0x0000000000000000000000000000000000000000', // Native ETH for gas
                limit: '10000000000000000' // 0.01 ETH limit for gas (decimal string)
            }
        }]

        console.log('🔑 Requesting permissions:', permissionParams)

        const response = await provider.request({
            method: 'wallet_grantPermissions',
            params: permissionParams
        })

        console.log('🔑 Permissions granted:', response)

        // Store session key data
        const sessionKeyData = {
            privateKey: privateKey,
            publicKey: publicKey,
            expiry: expiry,
            createdAt: Date.now(),
            address: walletAddress,
            permissions: GAME_PERMISSIONS
        }

        // Save to localStorage
        localStorage.setItem(
            getStorageKey(publicKey),
            JSON.stringify(sessionKeyData)
        )

        // Update module-level cache
        activeKeyPair = sessionKeyData

        console.log('🔑 Session key created and stored successfully')
        console.log('   Expires:', new Date(expiry * 1000).toLocaleString())

        return sessionKeyData
    } catch (error) {
        console.error('❌ Failed to create session key:', error)
        throw error
    }
}

/**
 * Revoke a session key
 * @param {Object} provider - Rise Wallet EIP-1193 provider
 * @param {string} publicKey - Public key of session to revoke
 * @returns {Promise<void>}
 */
export async function revokeSessionKey(provider, publicKey) {
    console.log('🔑 Revoking session key:', publicKey.slice(0, 20) + '...')

    try {
        // Call wallet to revoke permissions
        await provider.request({
            method: 'wallet_revokePermissions',
            params: [{ publicKey }]
        })

        console.log('🔑 Permissions revoked on wallet')
    } catch (error) {
        console.warn('⚠️ Failed to revoke on wallet (may already be revoked):', error.message)
    }

    // Always clean up local storage
    localStorage.removeItem(getStorageKey(publicKey))

    // Clear module cache if this was the active key
    if (activeKeyPair && activeKeyPair.publicKey === publicKey) {
        activeKeyPair = null
    }

    console.log('🔑 Session key removed from local storage')
}

/**
 * Clear all stored session keys
 */
export function clearAllSessionKeys() {
    console.log('🔑 Clearing all session keys...')

    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(SESSION_KEY_STORAGE_PREFIX)) {
            keysToRemove.push(key)
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    activeKeyPair = null

    console.log(`🔑 Cleared ${keysToRemove.length} session keys`)
}

/**
 * Sign a digest using session key
 * @param {string} digest - Hex string to sign
 * @param {Object} sessionKey - Session key with privateKey
 * @returns {string} Signature as hex string
 */
export function signWithSessionKey(digest, sessionKey) {
    if (!sessionKey || !sessionKey.privateKey) {
        throw new Error('No valid session key for signing')
    }

    const signature = Signature.toHex(
        P256.sign({
            payload: digest,
            privateKey: sessionKey.privateKey
        })
    )

    return signature
}

/**
 * Get time remaining until session key expires
 * @param {Object} sessionKey - Session key data
 * @returns {Object} Object with seconds, minutes, hours remaining
 */
export function getSessionKeyTimeRemaining(sessionKey) {
    if (!sessionKey || !sessionKey.expiry) {
        return { seconds: 0, minutes: 0, hours: 0, expired: true }
    }

    const now = Math.floor(Date.now() / 1000)
    const secondsRemaining = Math.max(0, sessionKey.expiry - now)

    return {
        seconds: secondsRemaining,
        minutes: Math.floor(secondsRemaining / 60),
        hours: Math.floor(secondsRemaining / 3600),
        expired: secondsRemaining <= 0
    }
}

export default {
    getActiveSessionKey,
    isSessionKeyValid,
    hasUsableSessionKey,
    createSessionKey,
    revokeSessionKey,
    clearAllSessionKeys,
    signWithSessionKey,
    getSessionKeyTimeRemaining,
    getStoredSessionKeys
}
