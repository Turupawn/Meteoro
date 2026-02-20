import { keccak256, toHex } from 'viem'
import { CONTRACT_ADDRESS } from './walletConfig.js'

// Log CONTRACT_ADDRESS at module load time for debugging
console.log('🎮 gamePermissions.js loaded, CONTRACT_ADDRESS:', CONTRACT_ADDRESS)

// Validate CONTRACT_ADDRESS at module load time
if (!CONTRACT_ADDRESS) {
    console.error('❌ CONTRACT_ADDRESS is not defined! Check your .env file and restart vite.')
    console.error('❌ Session key creation will fail without a valid contract address.')
}

export function getFunctionSelector(signature) {
    return keccak256(toHex(signature)).slice(0, 10)
}

// Only create GAME_CALLS if CONTRACT_ADDRESS is defined
export const GAME_CALLS = CONTRACT_ADDRESS ? [
    {
        to: CONTRACT_ADDRESS,
        signature: getFunctionSelector('rollDice(uint256)')
    }
] : []

export const SPEND_LIMITS = [
    {
        limit: '0x4563918244F40000', // 5 ETH in wei as hex (10 * 10^18)
        period: 'day',
        token: '0x0000000000000000000000000000000000000000' // Native ETH
    }
]

export const GAME_PERMISSIONS = {
    calls: GAME_CALLS,
    spend: SPEND_LIMITS
}

export default {
    GAME_CALLS,
    SPEND_LIMITS,
    GAME_PERMISSIONS,
    getFunctionSelector
}
