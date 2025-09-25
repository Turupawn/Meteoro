import { loadPhaser } from './game.js';
import { generateRandomBytes32, calculateCards, printLog } from './utils/utils.js';
import { 
    initWeb3, 
    getLocalWallet, 
    checkGameState, 
    commit,
    performReveal, 
    updateGasPrice,
    initializeNonce,
    initializeBetAmount,
    web3,
    getPlayerETHBalance,
    getMinimumPlayableBalance
} from './web3/blockchain_stuff.js';

import posthog from 'posthog-js'

posthog.init('phc_3vofleZVJy4GKoykZPb4bOEc7gjl6do5YoFDLB6NVYl',
    {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'always' // or 'always' to create profiles for anonymous users as well
    }
)

const POLL_INTERVAL = parseInt(import.meta.env.POLL_INTERVAL) || 1000

var game
var gameScene = null; // Reference to the main game scene

const MIN_BALANCE = "0.00001";
let commitStartTime = null;

let gameState = null;
let shouldProcessCommit = false;

// Loading coordination
let web3LoadingProgress = 0;
let gameDataLoadingProgress = 0;
let isWeb3Ready = false;
let isGameDataReady = false;

// Loading screen coordination
let loadingScreenReady = false;

// Add transaction state tracking
let isTransactionInProgress = false;
let lastTransactionHash = null;

async function loadDapp() {
  try {
    // Track app initialization
    posthog.capture('app_initialized', { 
      timestamp: Date.now() 
    });
    
    // Start Phaser with loading screen
    game = await loadPhaser();
    
    // Wait for loading screen to be ready
    await waitForLoadingScreen();
    
    // Start Web3 initialization in parallel
    initWeb3WithProgress();
    
    // Start game data loading in parallel
    loadGameData();
    
  } catch (error) {
    console.error("Error initializing game:", error);
    posthog.capture('app_initialization_error', { 
      error: error.message 
    });
  }
}

async function waitForLoadingScreen() {
  // Wait for loading screen to be ready
  while (!loadingScreenReady) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function initWeb3WithProgress() {
  try {
    // Update progress to show Web3 is starting
    web3LoadingProgress = 0.1;
    updateWeb3Progress(0.1);
    
    // Initialize Web3
    await initWeb3();
    
    // Update progress to show Web3 is ready
    web3LoadingProgress = 1;
    isWeb3Ready = true;
    updateWeb3Progress(1);
    
    console.log("Web3 initialization completed successfully");
    
    // Track successful Web3 initialization
    posthog.capture('web3_initialized', { 
      timestamp: Date.now() 
    });
    
  } catch (error) {
    console.error("Error initializing Web3:", error);
    // Mark as complete even if failed to prevent infinite loading
    web3LoadingProgress = 1;
    isWeb3Ready = true;
    updateWeb3Progress(1);
    
    // Track Web3 initialization error
    posthog.capture('web3_initialization_error', { 
      error: error.message 
    });
  }
}

function updateWeb3Progress(progress) {
  if (window.updateWeb3Progress) {
    window.updateWeb3Progress(progress);
  } else {
    console.warn("updateWeb3Progress not available yet, progress:", progress);
  }
}

function updateGameDataProgress(progress) {
  if (window.updateGameDataProgress) {
    window.updateGameDataProgress(progress);
  } else {
    console.warn("updateGameDataProgress not available yet, progress:", progress);
  }
}

async function loadGameData() {
  try {
    // Simulate progressive loading of game data
    console.log("Loading game data...")
    gameDataLoadingProgress = 0.2;
    updateGameDataProgress(0.2);

    console.log("Waiting for Web3 to be ready...")
    
    // Wait for Web3 to be ready
    while (!isWeb3Ready) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    gameDataLoadingProgress = 0.5;
    updateGameDataProgress(0.5);
    console.log("Initializing bet amount...")
    await initializeBetAmount();
    console.log("Updating gas price...")
    await new Promise(resolve => setTimeout(resolve, 150));
    gameDataLoadingProgress = 0.7;
    updateGameDataProgress(0.7);
    console.log("Updating gas price...")
    await updateGasPrice();
    console.log("Initializing nonce...")
    await new Promise(resolve => setTimeout(resolve, 150));
    await initializeNonce();
    gameDataLoadingProgress = 0.9;
    updateGameDataProgress(0.9);
    console.log("Checking game state...")
    await checkGameState();
    await new Promise(resolve => setTimeout(resolve, 150));    
    gameDataLoadingProgress = 1;
    isGameDataReady = true;
    updateGameDataProgress(1);
    console.log("Starting game loop...")
    startGameLoop();
  } catch (error) {
    console.error("Error loading game data:", error);
    gameDataLoadingProgress = 1;
    isGameDataReady = true;
    updateGameDataProgress(1);
  }
}

// Function to set the game scene reference
export function setGameScene(scene) {
    gameScene = scene;
}

// Function to notify that loading screen is ready
export function setLoadingScreenReady() {
    loadingScreenReady = true;
}

// Wait for game to be ready before starting
window.addEventListener('gameReady', () => {
  updateGameState();
});

loadDapp()

const onContractInitCallback = async () => {
  try {
    await initializeBetAmount();
    
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
    if (cardValue === 14) return "A";  // Ace is now 14 (strongest)
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

    // Don't process if a transaction is already in progress
    if (isTransactionInProgress) {
        printLog(['debug'], "Transaction in progress, skipping game loop");
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

        // Handle case where game is revealed (state 2n) and there's a pending commit
        if (gameState && gameState.gameState === 2n && pendingCommit) {
            const result = calculateCards(pendingCommit.secret, gameState.houseRandomness);
            
            if (commitStartTime) {
                const endTime = Date.now();
                const totalTime = endTime - commitStartTime;
                printLog(['profile'], "=== PERFORMANCE METRICS ===");
                printLog(['profile'], "Total time from commit to result:", totalTime, "ms");
                printLog(['profile'], "Start time:", new Date(commitStartTime).toISOString());
                printLog(['profile'], "End time:", new Date(endTime).toISOString());
                printLog(['profile'], "=========================");
                commitStartTime = null;
                
                // Track game completion performance
                posthog.capture('game_completed', {
                    game_id: gameState.gameId?.toString(),
                    player_card: result.playerCard,
                    house_card: result.houseCard,
                    total_time_ms: totalTime,
                    player_balance: gameState.playerETHBalance?.toString()
                });
            }

            clearStoredCommit();
            storePendingReveal(pendingCommit.secret);
            // Use the game scene reference instead of hardcoded index
            if (gameScene) {
                gameScene.updateCardDisplay(result.playerCard, result.houseCard);
            }
            printLog(['debug'], "Conditions met for reveal, attempting...");
            
            // Mark transaction as in progress
            isTransactionInProgress = true;
            try {
                await performReveal(pendingCommit.secret);
                printLog(['debug'], "Reveal transaction completed successfully");
                
                // Track successful reveal
                posthog.capture('reveal_transaction_success', {
                    game_id: gameState.gameId?.toString(),
                    player_card: result.playerCard,
                    house_card: result.houseCard
                });
                
            } catch (error) {
                printLog(['error'], "Reveal failed:", error);
                
                // Track reveal failure
                posthog.capture('reveal_transaction_failed', {
                    game_id: gameState.gameId?.toString(),
                    error: error.message
                });
                
                // If it's an "already known" error, clear the pending reveal
                if (error.message && error.message.includes('already known')) {
                    printLog(['debug'], "Transaction already known, clearing pending reveal");
                    clearPendingReveal();
                }
            } finally {
                isTransactionInProgress = false;
            }
        }
        
        // Handle case where game is already revealed (state 3n) and there's a pending reveal
        if (gameState && gameState.gameState === 3n && pendingReveal) {
            printLog(['debug'], "Game already revealed, clearing pending reveal");
            clearPendingReveal();
            
            // Calculate and display the result
            if (gameState.playerCard && gameState.houseCard) {
                const playerCard = parseInt(gameState.playerCard);
                const houseCard = parseInt(gameState.houseCard);
                if (!isNaN(playerCard) && !isNaN(houseCard)) {
                    if (gameScene) {
                        gameScene.updateCardDisplay(playerCard, houseCard);
                    }
                }
            }
        }
        
        // Handle new game requests
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
                
                // Track attempt to start game with pending commit
                posthog.capture('game_start_blocked_pending_commit', {
                    game_id: gameState.gameId?.toString()
                });
                
            } else if (!gameState) {
                printLog(['error'], "Global game state not initialized");
                shouldProcessCommit = false;
                posthog.capture('game_start_failed_uninitialized_state');
                
            } else if (BigInt(getPlayerETHBalance()) < BigInt(getMinimumPlayableBalance())) {
                printLog(['debug'], "Insufficient balance detected, UI will handle display");
                shouldProcessCommit = false;
                posthog.capture('game_start_blocked_insufficient_balance', {
                    player_balance: getPlayerETHBalance(),
                    minimum_balance: getMinimumPlayableBalance()
                });
                
            } else if ( gameState.gameState === 0n /* NotStarted */ ||
                        gameState.gameState === 3n /* Revealed */   ||
                        gameState.gameState === 4n /* Forfeited */) {
                const secret = generateRandomBytes32();
                storeCommit(secret);
                commitStartTime = Date.now();
                printLog(['profile'], "=== COMMIT REQUESTED ===");
                printLog(['profile'], "Start time:", new Date(commitStartTime).toISOString());

                printLog(['debug'], "Processing commit request...");
                
                // Track game start attempt
                posthog.capture('game_start_attempted', {
                    game_id: gameState.gameId?.toString(),
                    player_balance: gameState.playerETHBalance?.toString(),
                    game_state: gameState.gameState?.toString()
                });
                
                // Mark transaction as in progress
                isTransactionInProgress = true;
                try {
                    await commit(web3.utils.soliditySha3(secret));
                    shouldProcessCommit = false;
                    updateGameState();
                    printLog(['debug'], "Commit transaction completed successfully");
                    
                    // Track successful commit
                    posthog.capture('commit_transaction_success', {
                        game_id: gameState.gameId?.toString(),
                        player_balance: gameState.playerETHBalance?.toString()
                    });
                    
                } catch (error) {
                    printLog(['error'], "Commit failed:", error);
                    shouldProcessCommit = false;
                    
                    // Track commit failure
                    posthog.capture('commit_transaction_failed', {
                        game_id: gameState.gameId?.toString(),
                        error: error.message
                    });
                    
                    // If it's an "already known" error, clear the stored commit
                    if (error.message && error.message.includes('already known')) {
                        printLog(['debug'], "Transaction already known, clearing stored commit");
                        clearStoredCommit();
                    }
                } finally {
                    isTransactionInProgress = false;
                }
            }
        }
        updateGameState();
        printLog(['debug'], "=== GAME LOOP END ===");
    } catch (error) {
        printLog(['error'], "Error in game loop:", error);
        shouldProcessCommit = false;
        isTransactionInProgress = false;
        
        // Track game loop error
        posthog.capture('game_loop_error', {
            error: error.message
        });
    }
}

async function updateGameState() {
    try {
        if (!gameState) return;
        const wallet = getLocalWallet()
        // Use the game scene reference instead of hardcoded index
        if (gameScene) {
            gameScene.updateDisplay(gameState.playerETHBalance, gameState.playerGachaTokenBalance, gameState.recentHistory, wallet.address);
        }
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
    gameScene.cardDisplay.clearCardSprites();
    shouldProcessCommit = true;
    
    // Track manual commit request
    posthog.capture('commit_game_called', {
        timestamp: Date.now()
    });
}