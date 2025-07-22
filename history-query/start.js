require('dotenv').config();
const Web3 = require('web3');
const web3 = new Web3(process.env.RPC_URL);
const contractABI = require('../json_abi/MyContract.json');
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new web3.eth.Contract(contractABI, contractAddress);

async function printAllGames() {
    // Get the total number of games
    const nextGameId = await contract.methods.nextGameId().call();

    for (let gameId = 0; gameId < nextGameId; gameId++) {
        try {
            const game = await contract.methods.games(gameId).call();

            // Only print games that have a valid player address (skip empty slots)
            if (game.playerAddress === '0x0000000000000000000000000000000000000000') continue;

            const date = game.revealTimestamp && parseInt(game.revealTimestamp) > 0
                ? new Date(parseInt(game.revealTimestamp) * 1000).toLocaleString()
                : 'N/A';

            console.log(
                `GameID: ${gameId}, Player: ${game.playerAddress}, PlayerCard: ${game.playerCard}, HouseCard: ${game.houseCard}, Winner: ${game.winner}, RevealTime: ${date}`
            );
        } catch (err) {
            console.error(`Error fetching gameId ${gameId}:`, err.message);
        }
    }
}

printAllGames();
