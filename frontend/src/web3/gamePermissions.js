/**
 * Game Permissions Configuration
 * Defines session key permissions specific to Meteoro game
 */

import { keccak256, toHex, parseEther } from 'viem'
import { CONTRACT_ADDRESS } from './walletConfig.js'

/**
 * Compute function selector from signature
 * @param {string} signature - Function signature (e.g., 'commit(bytes32)')
 * @returns {string} First 4 bytes of keccak256 hash (selector)
 */
export function getFunctionSelector(signature) {
    return keccak256(toHex(signature)).slice(0, 10)
}

/**
 * Allowed contract calls for session key
 * These functions can be called without user popup confirmation
 */
export const GAME_CALLS = [
    // Commit a bet hash to start a game
    {
        to: CONTRACT_ADDRESS,
        signature: getFunctionSelector('commit(bytes32)')
    },
    // Reveal the secret to complete the game
    {
        to: CONTRACT_ADDRESS,
        signature: getFunctionSelector('reveal(bytes32)')
    },
    // Forfeit an in-progress game
    {
        to: CONTRACT_ADDRESS,
        signature: getFunctionSelector('forfeit()')
    }
]

/**
 * Spending limits for session key
 * Controls how much native token can be spent per period
 * Note: limit must be a hex string for Rise Wallet 0.3.0
 */
export const SPEND_LIMITS = [
    {
        limit: '0x8AC7230489E80000', // 10 ETH in wei as hex (10 * 10^18)
        period: 'day',
        token: '0x0000000000000000000000000000000000000000' // Native ETH
    }
]

/**
 * Combined permissions object for grantPermissions call
 */
export const GAME_PERMISSIONS = {
    calls: GAME_CALLS,
    spend: SPEND_LIMITS
}

/**
 * Check if a contract call is permitted by session key
 * @param {string} to - Target contract address
 * @param {string} data - Encoded function call data
 * @returns {boolean} True if call is permitted
 */
export function isCallPermitted(to, data) {
    if (!to || !data) return false

    const functionSelector = data.slice(0, 10).toLowerCase()
    const targetAddress = to.toLowerCase()

    return GAME_CALLS.some(call => {
        const permittedAddress = call.to?.toLowerCase()
        const permittedSelector = call.signature?.toLowerCase()

        // Match if address matches (or no address restriction) AND selector matches (or no selector restriction)
        const addressMatch = !permittedAddress || permittedAddress === targetAddress
        const selectorMatch = !permittedSelector || permittedSelector === functionSelector

        return addressMatch && selectorMatch
    })
}

export default {
    GAME_CALLS,
    SPEND_LIMITS,
    GAME_PERMISSIONS,
    isCallPermitted,
    getFunctionSelector
}
