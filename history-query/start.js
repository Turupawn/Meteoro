require('dotenv').config();
const Web3 = require('web3');

const web3 = new Web3(process.env.RPC_URL);
const contractABI = require('../json_abi/MyContract.json');
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new web3.eth.Contract(contractABI, contractAddress);

const MAX_BLOCK_RANGE = 100000;
const MAX_RECENT_PLAYERS = 50;

async function getAllGameCreatedEvents(startBlock, endBlock) {
    let allEvents = [];

    for (let from = startBlock; from <= endBlock; from += MAX_BLOCK_RANGE + 1) {
        const to = Math.min(from + MAX_BLOCK_RANGE, endBlock);
        console.log(`Fetching events from block ${from} to ${to}`);

        try {
            const events = await contract.getPastEvents('GameCreated', {
                fromBlock: from,
                toBlock: to
            });
            allEvents.push(...events);
        } catch (err) {
            console.error(`Error fetching from ${from} to ${to}:`, err.message);
        }
    }

    return allEvents;
}

async function getLast50GamesSummary() {
    try {
        const latestBlock = await web3.eth.getBlockNumber();
        console.log('Latest block:', latestBlock);

        const deployBlock = parseInt(process.env.DEPLOY_BLOCK || '0');
        const events = await getAllGameCreatedEvents(deployBlock, latestBlock);

        console.log(`Total GameCreated events: ${events.length}`);

        const seen = new Set();
        const uniquePlayerEvents = events
            .reverse()
            .filter((e) => {
                const player = e.returnValues.player;
                if (seen.has(player)) return false;
                seen.add(player);
                return true;
            })
            .slice(0, MAX_RECENT_PLAYERS);

        const allGames = [];

        for (const event of uniquePlayerEvents) {
            const player = event.returnValues.player;

            try {
                const gameState = await contract.methods.getGameState(player).call();
                const recentHistory = gameState[5]; // GameResult[] array

                for (const result of recentHistory) {
                    allGames.push({
                        player,
                        playerCard: parseInt(result.playerCard),
                        houseCard: parseInt(result.houseCard),
                        winner: result.winner,
                        timestamp: parseInt(result.timestamp)
                    });
                }
            } catch (err) {
                console.error(`Error fetching state for ${player}:`, err.message);
            }
        }

        // Sort all games by timestamp (most recent first) and take top 50
        const recentGames = allGames
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 50);

        console.log('\n=== Last 50 Games ===');
        for (const game of recentGames) {
            const date = new Date(game.timestamp * 1000).toLocaleString();
            console.log(`Player: ${game.player}, Card: ${game.playerCard}, House: ${game.houseCard}, Winner: ${game.winner}, Time: ${date}`);
        }
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

getLast50GamesSummary();
