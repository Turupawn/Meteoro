import Web3 from 'web3';

const PRINT_LEVELS = ['profile', 'error']; //['debug', 'profile', 'error'];

export function generateRandomBytes32() {
    return Web3.utils.randomHex(32);
}

export function calculateCards(secret, houseHash) {
    const secretBig = BigInt(secret);
    const houseHashBig = BigInt(houseHash);
    const xorResult = secretBig ^ houseHashBig;
    const playerCard = Number((xorResult >> 128n) % 13n) + 1;
    const houseCard = Number((xorResult & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn) % 13n) + 1;
    let winner;
    if (playerCard > houseCard) {
        winner = 'Player';
    } else {
        winner = 'House';
    }
    return { playerCard, houseCard, winner };
}

export function printLog(levels, ...args) {
    if (!Array.isArray(levels)) levels = [levels];
    const shouldPrint = levels.some(level => PRINT_LEVELS.includes(level));
    if (!shouldPrint) return;
    if (levels.includes('error')) {
        console.error(...args);
    } else {
        console.log(...args);
    }
} 