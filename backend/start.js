require('dotenv').config();
const express = require('express');
const Web3 = require('web3');
const app = express();
const port = process.env.PORT || 3000;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 500;

const web3 = new Web3(process.env.RPC_URL);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = require('./json_abi/MyContract.json');

const contract = new web3.eth.Contract(contractABI, contractAddress);

const houseAccount = web3.eth.accounts.privateKeyToAccount(process.env.HOUSE_PRIVATE_KEY);
web3.eth.accounts.wallet.add(houseAccount);

console.log('House wallet address:', houseAccount.address);
console.log('Server started on port', port);

let lastProcessedBlock = 0;
const processingGameIds = new Set();
let STAKE_AMOUNT = null;

function generateRandomHash() {
    return web3.utils.randomHex(32);
}

async function multiPostHashForGames(gameIdPlayerPairs) {
    try {
        if (gameIdPlayerPairs.length === 0) return;

        const filtered = gameIdPlayerPairs.filter(({ gameId }) => !processingGameIds.has(gameId));
        if (filtered.length === 0) return;

        filtered.forEach(({ gameId }) => processingGameIds.add(gameId));

        const validGameIds = [];
        const hashes = [];
        const playerMap = {};
        const stakeAmount = STAKE_AMOUNT;

        for (const { gameId, playerAddress } of filtered) {
            const hash = generateRandomHash();
            validGameIds.push(gameId);
            hashes.push(hash);
            playerMap[gameId] = playerAddress;
        }

        if (validGameIds.length === 0) return;

        const tx = {
            from: houseAccount.address,
            to: contractAddress,
            value: web3.utils.toBN(stakeAmount).mul(web3.utils.toBN(validGameIds.length)).toString(),
            gas: 500000 + 200000 * validGameIds.length,
            data: contract.methods.multiPostHash(validGameIds, hashes).encodeABI()
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, houseAccount.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        if (receipt.status) {
            validGameIds.forEach((gameId, idx) => {
                console.log(`Posted hash for game ${gameId} (player ${playerMap[gameId]}):`, {
                    hash: hashes[idx],
                    txHash: receipt.transactionHash
                });
            });
        } else {
            console.error(`multiPostHash transaction failed:`, receipt);
            validGameIds.forEach(gameId => processingGameIds.delete(gameId));
        }
    } catch (error) {
        console.error('Error in multiPostHashForGames:', error);
        gameIdPlayerPairs.forEach(({ gameId }) => processingGameIds.delete(gameId));
    }
}

// Function to check for new games
async function checkForNewGames() {
    try {
        const currentBlock = await web3.eth.getBlockNumber();
        if (lastProcessedBlock === 0) {
            lastProcessedBlock = currentBlock;
            return;
        }
        if (lastProcessedBlock >= currentBlock) {
            return;
        }
        const toBlock = Math.min(currentBlock, lastProcessedBlock + 5);
        try {
            const [createdEvents, forfeitedEvents] = await Promise.all([
                contract.getPastEvents('GameCreated', {
                    fromBlock: lastProcessedBlock + 1,
                    toBlock: toBlock
                }),
                contract.getPastEvents('GameForfeited', {
                    fromBlock: lastProcessedBlock + 1,
                    toBlock: toBlock
                })
            ]);
            const newGames = [];
            for (const event of createdEvents) {
                try {
                    const playerAddress = event.returnValues.player;
                    const gameId = event.returnValues.gameId;
                    console.log('New game created:', { player: playerAddress, gameId: gameId });
                    newGames.push({ gameId, playerAddress });
                } catch (error) {
                    console.error('Error processing game created event:', error);
                }
            }
            await multiPostHashForGames(newGames);
            for (const event of forfeitedEvents) {
                try {
                    const playerAddress = event.returnValues.player;
                    console.log('Game forfeited:', { player: playerAddress });
                    // Remove from processing set if it was being processed
                    processingGameIds.delete(playerAddress);
                } catch (error) {
                    console.error('Error processing forfeit event:', error);
                }
            }
            lastProcessedBlock = toBlock;
        } catch (error) {
            if (error.message.includes('block meta not found') || 
                error.message.includes('invalid block range params') ||
                error.message.includes('data out-of-bounds')) {
                lastProcessedBlock = Math.max(lastProcessedBlock, currentBlock - 5);
                console.log('Block range error, adjusting lastProcessedBlock to:', lastProcessedBlock);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error checking for new games:', error);
    }
}

async function initialize() {
    STAKE_AMOUNT = await contract.methods.STAKE_AMOUNT().call();
    console.log('Stake amount loaded:', STAKE_AMOUNT);
    setInterval(checkForNewGames, POLL_INTERVAL);
    console.log('Initialization complete. Polling for new games.');
}

initialize();

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        houseAddress: houseAccount.address,
        lastProcessedBlock: lastProcessedBlock,
        processingGameIds: Array.from(processingGameIds)
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
