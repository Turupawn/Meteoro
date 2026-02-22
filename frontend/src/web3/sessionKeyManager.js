import { P256, Signature, PublicKey } from 'ox'
import { SESSION_KEY_STORAGE_PREFIX, SESSION_KEY_EXPIRY_SECONDS, CONTRACT_ADDRESS } from './walletConfig.js'
import { GAME_PERMISSIONS } from './gamePermissions.js'

let activeKeyPair = null

function getStorageKey(publicKey) {
    return `${SESSION_KEY_STORAGE_PREFIX}.${publicKey}`
}

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
                // Skip invalid entries
            }
        }
    }
    return keys
}

export function getActiveSessionKey(walletAddress = null) {
    if (activeKeyPair && isSessionKeyValid(activeKeyPair, walletAddress)) {
        return activeKeyPair
    }

    const storedKeys = getStoredSessionKeys()
    const validKey = storedKeys.find(key => isSessionKeyValid(key, walletAddress))

    if (validKey) {
        activeKeyPair = validKey
        return validKey
    }

    // Clean up stale/expired/wrong-contract keys
    const staleKeys = storedKeys.filter(key => !isSessionKeyValid(key, walletAddress))
    if (staleKeys.length > 0) {
        console.log(`🔑 Cleaning up ${staleKeys.length} stale session keys`)
        staleKeys.forEach(key => {
            localStorage.removeItem(getStorageKey(key.publicKey))
        })
    }

    activeKeyPair = null
    return null
}

export function isSessionKeyValid(sessionKey, walletAddress = null) {
    if (!sessionKey || !sessionKey.publicKey || !sessionKey.privateKey) {
        return false
    }

    if (!sessionKey.expiry) {
        return false
    }

    const now = Math.floor(Date.now() / 1000)
    if (sessionKey.expiry <= now) {
        return false
    }

    if (walletAddress && sessionKey.address) {
        if (sessionKey.address.toLowerCase() !== walletAddress.toLowerCase()) {
            return false
        }
    }

    // Check if session key has permissions for the current contract address
    // If contract was redeployed, old session keys are stale
    if (CONTRACT_ADDRESS && sessionKey.permissions?.calls) {
        const hasCurrentContract = sessionKey.permissions.calls.some(
            call => call.to?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
        )
        if (!hasCurrentContract) {
            console.log('🔑 Session key stale: permissions target old contract, not', CONTRACT_ADDRESS)
            return false
        }
    }

    return true
}

export function hasUsableSessionKey(walletAddress = null) {
    return getActiveSessionKey(walletAddress) !== null
}

export async function createSessionKey(provider, walletAddress, additionalCalls = []) {
    console.log('🔑 Creating session key...')

    // Merge base permissions with additional calls
    const permissions = {
        calls: [...(GAME_PERMISSIONS.calls || []), ...additionalCalls],
        spend: GAME_PERMISSIONS.spend
    }

    console.log('🔑 Merged permissions:', JSON.stringify(permissions, null, 2))

    // Validate permissions before sending to Rise Wallet
    if (!permissions.calls || permissions.calls.length === 0) {
        console.error('⚠️ permissions.calls is empty - CONTRACT_ADDRESS may be undefined')
        console.error('⚠️ Check your .env file and restart vite')
    }

    // Check for undefined values in calls
    for (const call of permissions.calls || []) {
        if (!call.to) {
            throw new Error('Session key creation failed: CONTRACT_ADDRESS is undefined. Check your .env file and restart vite.')
        }
    }

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

    console.log('🔑 Permission params:', JSON.stringify(permissionParams, null, 2))

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

    localStorage.setItem(
        getStorageKey(publicKey),
        JSON.stringify(sessionKeyData)
    )

    activeKeyPair = sessionKeyData

    console.log('🔑 Session key created, expires:', new Date(expiry * 1000).toLocaleString())

    return sessionKeyData
}

export async function revokeSessionKey(provider, publicKey) {
    try {
        await provider.request({
            method: 'wallet_revokePermissions',
            params: [{ publicKey }]
        })
    } catch (error) {
        // May already be revoked
    }

    localStorage.removeItem(getStorageKey(publicKey))

    if (activeKeyPair && activeKeyPair.publicKey === publicKey) {
        activeKeyPair = null
    }
}

export function clearAllSessionKeys() {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(SESSION_KEY_STORAGE_PREFIX)) {
            keysToRemove.push(key)
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    activeKeyPair = null
}

export function clearAllGameData() {
    clearAllSessionKeys()
    localStorage.removeItem('riseWallet')
    localStorage.removeItem('selectedBetAmount')
    
    return 'Game data cleared. Refresh to reconnect.'
}

if (typeof window !== 'undefined') {
    window.clearGameData = clearAllGameData
    window.clearSessionKeys = clearAllSessionKeys
    window.listSessionKeys = () => {
        const keys = getStoredSessionKeys()
        console.log(`📋 Found ${keys.length} stored session keys:`)
        keys.forEach((key, i) => {
            const now = Math.floor(Date.now() / 1000)
            const expired = key.expiry <= now
            const hasUsdcSpend = key.permissions?.spend?.some(s =>
                s.token && s.token !== '0x0000000000000000000000000000000000000000'
            )
            const hasUsdcCalls = key.permissions?.calls?.length > 1
            console.log(`  Key ${i}:`)
            console.log(`    publicKey: ${key.publicKey}`)
            console.log(`    expiry: ${new Date(key.expiry * 1000).toLocaleString()} (${expired ? 'EXPIRED' : 'valid'})`)
            console.log(`    address: ${key.address}`)
            console.log(`    hasUsdcSpend: ${hasUsdcSpend}`)
            console.log(`    hasUsdcCalls: ${hasUsdcCalls}`)
            console.log(`    calls:`, key.permissions?.calls)
            console.log(`    spend:`, key.permissions?.spend)
        })
        return keys
    }
}

export function signWithSessionKey(digest, sessionKey) {
    if (!sessionKey || !sessionKey.privateKey) {
        throw new Error('No valid session key for signing')
    }

    return Signature.toHex(
        P256.sign({
            payload: digest,
            privateKey: sessionKey.privateKey
        })
    )
}

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
    clearAllGameData,
    signWithSessionKey,
    getSessionKeyTimeRemaining,
    getStoredSessionKeys
}
