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
console.log('Contract address:', contractAddress);
console.log('Server started on port', port);

let lastProcessedBlock = 0;
const processingGameIds = new Set();
let currentNonce = null;
let lastProcessedGameId = null;

function generateRandomHash() {
    return web3.utils.randomHex(32);
}

function getAndIncrementNonce() {
    if (currentNonce === null) {
        console.error('Nonce not initialized');
        return null;
    }
    return currentNonce++;
}

async function multiPostRandomnessForGames(randomness, totalBetAmount) {
    try {
        if (!randomness || randomness.length === 0) return;
        
        const nonce = getAndIncrementNonce();
        
        if (nonce === null) {
            console.error('Failed to get nonce');
            return;
        }
        
        const tx = {
            from: houseAccount.address,
            to: contractAddress,
            value: totalBetAmount,
            gas: 1000000 + 500000 * randomness.length, // Fixed high gas limit for speed
            nonce: nonce,
            data: contract.methods.multiPostRandomness(randomness).encodeABI()
        };
        
        console.log(`Sending multiPostRandomness transaction with nonce ${nonce} and value ${totalBetAmount}...`);
        const signedTx = await web3.eth.accounts.signTransaction(tx, houseAccount.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        if (receipt.status) {
            console.log(`multiPostRandomness transaction successful:`, receipt.transactionHash);
            randomness.forEach((hash, idx) => {
                console.log(`Posted hash #${idx + 1}:`, {
                    hash: hash,
                    txHash: receipt.transactionHash
                });
            });
        } else {
            console.error(`multiPostRandomness transaction failed:`, receipt);
            // Reset lastProcessedGameId on transaction failure
            lastProcessedGameId = null;
        }
    } catch (error) {
        console.error('Error in multiPostRandomnessForGames:', error);
        
        // Reset lastProcessedGameId on any error
        lastProcessedGameId = null;
        
        // If it's an "already known" error, the transaction was already sent
        if (error.message && error.message.includes('already known')) {
            console.log('Transaction already known, skipping...');
        }
        // If it's a "nonce too low" error, reset the nonce
        else if (error.message && error.message.includes('nonce too low')) {
            console.log('Nonce too low, resetting nonce...');
            currentNonce = await web3.eth.getTransactionCount(houseAccount.address, 'latest');
        }
        // If it's a revert error, log more details
        else if (error.message && error.message.includes('reverted')) {
            console.error('Transaction reverted. Error details:', error);
            if (error.receipt) {
                console.error('Receipt:', error.receipt);
            }
        }
    }
}

// Function to check for new games
async function checkForNewGames() {
    try {
        // Get backend state: last responded gameId, pending count, and pending bet amounts
        const backendState = await contract.methods.getBackendGameState().call({}, 'pending');
        const lastRandomnessPostedGameId = parseInt(backendState[0]);
        const pendingGameCount = parseInt(backendState[1]);
        const pendingBetAmounts = backendState[2]; // Array of bet amounts for pending games

        if(pendingGameCount === 0) {
            return;
        }

        if(lastProcessedGameId != null && lastProcessedGameId > lastRandomnessPostedGameId) {
            return;
        }
        
        // Calculate total ETH needed by summing all pending bet amounts
        let totalBetAmount = web3.utils.toBN(0);
        for (let i = 0; i < pendingBetAmounts.length; i++) {
            totalBetAmount = totalBetAmount.add(web3.utils.toBN(pendingBetAmounts[i]));
        }
        
        lastProcessedGameId = lastRandomnessPostedGameId + pendingGameCount;
        console.log(`Found ${pendingGameCount} pending games (last processed: ${lastProcessedGameId}, current: ${lastRandomnessPostedGameId}), generating randomness...`);
        console.log(`Total bet amount to send: ${totalBetAmount.toString()} wei`);
        
        const randomness = Array.from({ length: pendingGameCount }, () => generateRandomHash());
        await multiPostRandomnessForGames(randomness, totalBetAmount.toString());
    } catch (error) {
        console.error('Error checking for new games:', error);
    }
}

async function initialize() {
    try {
        // Initialize nonce only once at startup
        currentNonce = await web3.eth.getTransactionCount(houseAccount.address, 'latest');
        console.log('Initial nonce:', currentNonce);
        
        setInterval(checkForNewGames, POLL_INTERVAL);
        console.log('Initialization complete. Polling for new games.');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

initialize();

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        houseAddress: houseAccount.address,
        lastProcessedBlock: lastProcessedBlock,
        processingGameIds: Array.from(processingGameIds),
        currentNonce: currentNonce,
        lastProcessedGameId: lastProcessedGameId,
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
