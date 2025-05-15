require('dotenv').config();
const express = require('express');
const Web3 = require('web3');
const app = express();
const port = process.env.PORT || 3000;
const POLL_INTERVAL = 500;

// Initialize Web3
const web3 = new Web3(process.env.RPC_URL);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = require('../json_abi/MyContract.json');

// Create contract instance
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Create house wallet from private key
const houseAccount = web3.eth.accounts.privateKeyToAccount(process.env.HOUSE_PRIVATE_KEY);
web3.eth.accounts.wallet.add(houseAccount);

console.log('House wallet address:', houseAccount.address);
console.log('Server started on port', port);

// Keep track of processed events and transactions
let lastProcessedBlock = 0;
const processingGameIds = new Set(); // Track games being processed

// Function to generate random bytes32 hash
function generateRandomHash() {
    return web3.utils.randomHex(32);
}

// Function to post hash for a player
async function postHashForPlayer(playerAddress, gameId) {
    try {
        // Check if we're already processing this game
        if (processingGameIds.has(gameId)) {
            console.log(`Already processing game ${gameId}, skipping`);
            return;
        }

        // Mark game as processing immediately
        processingGameIds.add(gameId);
        console.log(`Started processing game ${gameId}`);

        const hash = generateRandomHash();
        const stakeAmount = await contract.methods.STAKE_AMOUNT().call();
        
        const tx = {
            from: houseAccount.address,
            to: contractAddress,
            value: stakeAmount,
            gas: 300000,
            data: contract.methods.postHash(playerAddress, hash).encodeABI()
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, houseAccount.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        if (receipt.status) {
            console.log(`Posted hash for game ${gameId} (player ${playerAddress}):`, {
                hash: hash,
                txHash: receipt.transactionHash
            });
        } else {
            console.error(`Transaction failed for game ${gameId}:`, receipt);
            // Remove from processing set if transaction failed
            processingGameIds.delete(gameId);
        }
    } catch (error) {
        console.error('Error posting hash:', error);
        // Remove from processing set if there was an error
        processingGameIds.delete(gameId);
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

        // Ensure we don't try to query future blocks
        if (lastProcessedBlock >= currentBlock) {
            return;
        }

        // Only process up to 5 blocks at a time to avoid getting too many events
        const toBlock = Math.min(currentBlock, lastProcessedBlock + 5);

        try {
            const events = await contract.getPastEvents('GameCreated', {
                fromBlock: lastProcessedBlock + 1,
                toBlock: toBlock,
                // Add these options to handle block range issues
                filter: {},
                topics: []
            });

            // Process events in order
            for (const event of events) {
                const playerAddress = event.returnValues.player;
                const gameId = event.returnValues.gameId;
                console.log('New game created:', { player: playerAddress, gameId: gameId });
                
                await postHashForPlayer(playerAddress, gameId);
            }

            // Only update lastProcessedBlock if we successfully processed all blocks
            lastProcessedBlock = toBlock;
        } catch (error) {
            if (error.message.includes('block meta not found') || 
                error.message.includes('invalid block range params')) {
                // If block not found or invalid range, try again with a smaller range
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

// Start polling for new games
setInterval(checkForNewGames, POLL_INTERVAL);

// Update health check to show processing game IDs
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