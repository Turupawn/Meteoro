import { loadPhaser } from './game.js';
import { generateRandomBytes32, calculateCards, printLog } from './utils.js';
import { 
    initWeb3, 
    getLocalWallet, 
    checkGameState, 
    commit,
    performReveal, 
    updateGasPrice,
    initializeNonce,
    initializeStakeAmount,
    web3
} from './blockchain_stuff.js';

const POLL_INTERVAL = 150

var game

const MIN_BALANCE = "0.00001";
let commitStartTime = null;

let gameState = null;
let shouldProcessCommit = false;

async function loadDapp() {
  try {
    game = await loadPhaser();
    await initWeb3();
    onContractInitCallback();
  } catch (error) {
    console.error("Error initializing contract:", error);
  }
}

loadDapp()

const onContractInitCallback = async () => {
  try {
    await initializeStakeAmount();
    
    await updateGasPrice();
    await initializeNonce();
    
    await checkGameState();
    
    updateGameState();
    startGameLoop();
        
    window.dispatchEvent(new CustomEvent('gameReady'));
    
  } catch (error) {
    console.error("Error in contract initialization:", error);

  }
}

function getStoredSecret() {
    const secretData = localStorage.getItem('playerSecret');
    return secretData ? JSON.parse(secretData) : null;
}

function clearStoredSecret() {
    printLog(['debug'], "=== CLEAR SECRET ===");
    printLog(['debug'], "Secret before clearing:", getStoredSecret());
    printLog(['debug'], "===================");
    localStorage.removeItem('playerSecret');
    clearStoredCommit()
    clearPendingReveal()
}

function getCardDisplay(cardValue) {
    if (cardValue === 1) return "A";
    if (cardValue === 11) return "J";
    if (cardValue === 12) return "Q";
    if (cardValue === 13) return "K";
    return cardValue.toString();
}

async function gameLoop() {
    const wallet = getLocalWallet();
    if (!wallet) {
        printLog(['debug'], "No wallet found, skipping game loop");
        return;
    }

    try {
        printLog(['debug'], "=== GAME LOOP START ===");

        gameState = await checkGameState();
        printLog(['debug'], "Current game state:", gameState);
        
        const pendingCommit = getStoredCommit();
        const pendingReveal = getPendingReveal();
        printLog(['debug'], "Pending commit:", pendingCommit);
        printLog(['debug'], "Pending reveal:", pendingReveal);

        if (gameState && gameState.gameState === 2n && pendingCommit) {
            const result = calculateCards(pendingCommit.secret, gameState.houseHash);
            
            if (commitStartTime) {
                const endTime = Date.now();
                const totalTime = endTime - commitStartTime;
                printLog(['profile'], "=== PERFORMANCE METRICS ===");
                printLog(['profile'], "Total time from commit to result:", totalTime, "ms");
                printLog(['profile'], "Start time:", new Date(commitStartTime).toISOString());
                printLog(['profile'], "End time:", new Date(endTime).toISOString());
                printLog(['profile'], "=========================");
                commitStartTime = null;
            }

            clearStoredCommit();
            storePendingReveal(pendingCommit.secret);
            game.scene.scenes[0].updateCardDisplay(result.playerCard, result.houseCard);
            printLog(['debug'], "Conditions met for reveal, attempting...");
            await performReveal(pendingCommit.secret);
        }
        if (
            gameState && (
                gameState.gameState === 0n /* NotStarted */ ||
                gameState.gameState === 3n /* Revealed */   ||
                gameState.gameState === 4n /* Forfeited */)
            && shouldProcessCommit) {
            shouldProcessCommit = false;
            const storedCommit = getStoredCommit();
            if (storedCommit) {
                printLog(['debug'], "Found pending commit from previous game:", storedCommit);
                alert("Cannot start new game while previous game's commit is still pending. Please wait for the current game to complete.");
                shouldProcessCommit = false;
            } else if (!gameState) {
                printLog(['error'], "Global game state not initialized");
                shouldProcessCommit = false;
            } else if (BigInt(gameState.playerBalance) < BigInt(web3.utils.toWei(MIN_BALANCE, 'ether'))) {
                const currentEth = web3.utils.fromWei(gameState.playerBalance, 'ether');
                alert(`Insufficient balance! You need at least ${MIN_BALANCE} ETH to play.\nCurrent balance: ${parseFloat(currentEth).toFixed(6)} ETH`);
                shouldProcessCommit = false;
            } else if ( gameState.gameState === 0n /* NotStarted */ ||
                        gameState.gameState === 3n /* Revealed */   ||
                        gameState.gameState === 4n /* Forfeited */) {
                const secret = generateRandomBytes32();
                storeCommit(secret);
                commitStartTime = Date.now();
                printLog(['profile'], "=== COMMIT REQUESTED ===");
                printLog(['profile'], "Start time:", new Date(commitStartTime).toISOString());

                printLog(['debug'], "Processing commit request...");
                try {
                    await commit(web3.utils.soliditySha3(secret));
                    shouldProcessCommit = false;
                    updateGameState();
                } catch (error) {
                    printLog(['error'], "Commit failed:", error);
                    shouldProcessCommit = false;
                }
            }
        }
        updateGameState();
        printLog(['debug'], "=== GAME LOOP END ===");
    } catch (error) {
        printLog(['error'], "Error in game loop:", error);
        shouldProcessCommit = false;
    }
}

async function updateGameState() {
    try {
        if (!gameState) return;
        const wallet = getLocalWallet()
        game.scene.scenes[0].updateDisplay(gameState.playerBalance, gameState.recentHistory, wallet.address);
    } catch (error) {
        console.error("Error updating game state:", error);
    }
}

function startGameLoop() {
    gameLoop();
    setInterval(gameLoop, POLL_INTERVAL);
}
const onWalletConnectedCallback = async () => {
}

function storeCommit(secret) {
    printLog(['debug'], "=== STORE COMMIT ===");
    printLog(['debug'], "Previous commit:", getStoredCommit());
    printLog(['debug'], "New commit:", secret);
    printLog(['debug'], "Commitment:", web3.utils.soliditySha3(secret));
    localStorage.setItem('pendingCommit', JSON.stringify({
        secret: secret,
        timestamp: Date.now()
    }));
    printLog(['debug'], "Stored commit:", getStoredCommit());
    printLog(['debug'], "===================");
}

function getStoredCommit() {
    const commitData = localStorage.getItem('pendingCommit');
    return commitData ? JSON.parse(commitData) : null;
}

function clearStoredCommit() {
    printLog(['debug'], "=== CLEAR COMMIT ===");
    printLog(['debug'], "Commit before clearing:", getStoredCommit());
    printLog(['debug'], "===================");
    localStorage.removeItem('pendingCommit');
}

function storePendingReveal(secret) {
    printLog(['debug'], "=== STORE PENDING REVEAL ===");
    printLog(['debug'], "Previous pending reveal:", getPendingReveal());
    printLog(['debug'], "New pending reveal:", secret);
    localStorage.setItem('pendingReveal', JSON.stringify({
        secret: secret,
        timestamp: Date.now()
    }));
    printLog(['debug'], "Stored pending reveal:", getPendingReveal());
    printLog(['debug'], "===================");
}

function getPendingReveal() {
    const revealData = localStorage.getItem('pendingReveal');
    return revealData ? JSON.parse(revealData) : null;
}

function clearPendingReveal() {
    printLog(['debug'], "=== CLEAR PENDING REVEAL ===");
    printLog(['debug'], "Pending reveal before clearing:", getPendingReveal());
    printLog(['debug'], "===================");
    localStorage.removeItem('pendingReveal');
}

export async function commitGame() {
    shouldProcessCommit = true;
}