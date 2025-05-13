require('dotenv').config();
const express = require('express');
const Web3 = require('web3');
const app = express();
const port = process.env.PORT || 3000;

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

// Keep track of processed events
let lastProcessedBlock = 0;

// Function to generate random bytes32 hash
function generateRandomHash() {
    return web3.utils.randomHex(32);
}

// Function to post hash for a player
async function postHashForPlayer(playerAddress) {
    try {
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
        
        console.log(`Posted hash for player ${playerAddress}:`, {
            hash: hash,
            txHash: receipt.transactionHash
        });
    } catch (error) {
        console.error('Error posting hash:', error);
    }
}

// Function to check for new games
async function checkForNewGames() {
    try {
        // Get current block number
        const currentBlock = await web3.eth.getBlockNumber();
        
        // If we haven't processed any blocks yet, start from current block
        if (lastProcessedBlock === 0) {
            lastProcessedBlock = currentBlock;
            return;
        }

        // Get events from last processed block to current block
        const events = await contract.getPastEvents('GameCreated', {
            fromBlock: lastProcessedBlock,
            toBlock: currentBlock
        });

        // Process each new game
        for (const event of events) {
            const playerAddress = event.returnValues.player;
            console.log('New game created by player:', playerAddress);
            
            // Wait a short time to ensure the commit transaction is mined
            setTimeout(() => {
                postHashForPlayer(playerAddress);
            }, 5000);
        }

        // Update last processed block
        lastProcessedBlock = currentBlock;
    } catch (error) {
        console.error('Error checking for new games:', error);
    }
}

// Start polling for new games
setInterval(checkForNewGames, 10000); // Check every 10 seconds

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        houseAddress: houseAccount.address,
        lastProcessedBlock: lastProcessedBlock
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});