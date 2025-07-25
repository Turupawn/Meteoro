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

async function multiPostRandomnessForGames(randomness) {
    try {
        if (!randomness || randomness.length === 0) return;
        const stakeAmount = STAKE_AMOUNT;
        const tx = {
            from: houseAccount.address,
            to: contractAddress,
            value: web3.utils.toBN(stakeAmount).mul(web3.utils.toBN(randomness.length)).toString(),
            gas: 500000 + 200000 * randomness.length,
            data: contract.methods.multiPostRandomness(randomness).encodeABI()
        };
        const signedTx = await web3.eth.accounts.signTransaction(tx, houseAccount.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        if (receipt.status) {
            randomness.forEach((hash, idx) => {
                console.log(`Posted hash #${idx + 1}:`, {
                    hash: hash,
                    txHash: receipt.transactionHash
                });
            });
        } else {
            console.error(`multiPostRandomness transaction failed:`, receipt);
        }
    } catch (error) {
        console.error('Error in multiPostRandomnessForGames:', error);
    }
}

// Function to check for new games
async function checkForNewGames() {
    try {
        // Get backend state: last responded gameId and pending count
        const backendState = await contract.methods.getBackendGameState().call();
        const lastRandomnessPostedGameIdStr = backendState[0];
        const pendingGameCountStr = backendState[1];
        const lastRandomnessPostedGameId = parseInt(lastRandomnessPostedGameIdStr);
        const pendingGameCount = parseInt(pendingGameCountStr);
        if (pendingGameCount === 0) return;

        // Generate randomness array
        const randomness = Array.from({ length: pendingGameCount }, () => generateRandomHash());
        await multiPostRandomnessForGames(randomness);
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
