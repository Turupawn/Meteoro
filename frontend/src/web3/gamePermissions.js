import { keccak256, toHex } from 'viem'
import { CONTRACT_ADDRESS } from './walletConfig.js'

export function getFunctionSelector(signature) {
    return keccak256(toHex(signature)).slice(0, 10)
}

export const GAME_CALLS = [
    {
        to: CONTRACT_ADDRESS,
        signature: getFunctionSelector('rollDice()')
    }
]

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
