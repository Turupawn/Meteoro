import { loadPhaser } from './game.js';
import posthog from 'posthog-js';
import { generateRandomBytes32, calculateCards, printLog } from './utils/utils.js';
import { keccak256 } from 'viem';
import {
    initWeb3,
    getLocalWallet,
    checkGameState,
    checkInitialGameState,
    commit,
    performReveal,
    startEventMonitoring,
    stopEventMonitoring,
    warmupSdkAndCrypto
} from './web3/blockchain_stuff.js';

import {
    needsMigration,
    performSilentMigration,
    printLegacyWalletForBackup
} from './web3/legacyWalletMigration.js';

import {
    captureError,
    captureEvent,
    captureGameEvent,
    setWalletAddressGetter,
} from './session_tracking.js';

import {
    getMinimumPlayableBalance,
    getPlayerETHBalance,
    getGameState,
    updateGameState,
    updateBalances
} from './gameState.js';

import { showConnectButton } from './hud/hudButtons/connectButton.js';

var game
var gameScene = null; // Reference to the main game scene

const MIN_BALANCE = "0.00001";
const GAME_LOOP_INTERVAL = 50;
let commitStartTime = null;

let gameState = null;
let shouldProcessCommit = false;

let precomputedSecret = null;
let precomputedHash = null;

function precomputeNextCommit() {
    precomputedSecret = generateRandomBytes32();
    precomputedHash = keccak256(precomputedSecret);
}

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

let initialRecentHistory = [];
async function loadDapp() {
    try {
        // Set up wallet address getter for error tracking
        setWalletAddressGetter(() => getLocalWallet()?.address || 'unknown');

        // Track app initialization
        captureEvent('app_initialized', {
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
        captureError(error, { function: 'loadDapp' });
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
        // Print legacy wallet credentials immediately for backup (before anything else)
        printLegacyWalletForBackup();

        // Update progress to show Web3 is starting
        web3LoadingProgress = 0.1;
        updateWeb3Progress(0.1);

        // Initialize Web3
        const result = await initWeb3();

        if (result.wallet) {
            console.log("Wallet already connected:", result.wallet);
            
            // Check for legacy wallet migration for returning users
            if (needsMigration()) {
                console.log("Legacy wallet migration needed for returning user");
                performSilentMigration(result.wallet.address);
            }
        } else {
            console.log("Web3 initialized, waiting for wallet connection...");
            // Show Connect Button
            showConnectButton();
        }

        // Update progress to show Web3 is ready (partially)
        web3LoadingProgress = 1;
        isWeb3Ready = true;
        updateWeb3Progress(1);

        console.log("Web3 initialization completed successfully");

        // Track successful Web3 initialization
        captureEvent('web3_initialized', {
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("Error initializing Web3:", error);
        // Mark as complete even if failed to prevent infinite loading
        web3LoadingProgress = 1;
        isWeb3Ready = true;
        updateWeb3Progress(1);

        // Track Web3 initialization error
        captureEvent('web3_initialization_error', {
            error: error.message
        });
        captureError(error, { function: 'initWeb3WithProgress' });
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
        updateGameDataProgress(0.7);
        console.log("Checking initial game state...")
        gameState = await checkInitialGameState();

        gameDataLoadingProgress = 0.9;
        updateGameDataProgress(0.9);
        console.log("Starting real-time event monitoring...")
        startEventMonitoring()

        if (!gameState) {
            throw new Error("Failed to load initial game state - contract may not be deployed or accessible")
        }

        initialRecentHistory = gameState.recentHistory || [];

        // Convert BigInt values to strings for readable output (recursive)
        const convertBigIntToString = (obj) => {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj === 'bigint') return obj.toString();
            if (Array.isArray(obj)) return obj.map(convertBigIntToString);
            if (typeof obj === 'object') {
                const converted = {};
                for (const [key, value] of Object.entries(obj)) {
                    converted[key] = convertBigIntToString(value);
                }
                return converted;
            }
            return obj;
        };

        const gameStateForLog = convertBigIntToString(gameState);
        console.log("Initial game state from getInitialFrontendGameState:", JSON.stringify(gameStateForLog, null, 2));

        const pendingReveal = getPendingReveal();
        if (pendingReveal) {
            console.log("Pending reveal found:", JSON.stringify(pendingReveal, null, 2));
            try {
                console.log("Attempting to reveal pending secret...");
                await performReveal(pendingReveal.secret);
                console.log("Reveal completed successfully");
            } catch (error) {
                console.log("Reveal failed:", error.message);
                captureError(error, { function: 'loadGameData attempt to reveal pending secret' });
            }
        } else {
            console.log("No pending reveal found");
        }

        await new Promise(resolve => setTimeout(resolve, 150));
        gameDataLoadingProgress = 1;
        isGameDataReady = true;
        updateGameDataProgress(1);
        console.log("Starting game loop...")
        await warmupSdkAndCrypto();
        precomputeNextCommit();
        startGameLoop();
    } catch (error) {
        console.error("Error loading game data:", error);
        gameDataLoadingProgress = 1;
        isGameDataReady = true;
        updateGameDataProgress(1);
        captureError(error, { function: 'loadGameData' });
    }
}

// Function to set the game scene reference
export function setGameScene(scene) {
    gameScene = scene;
    gameScene.gameHistory.initializeHistory(initialRecentHistory);
}

// Function to notify that loading screen is ready
export function setLoadingScreenReady() {
    loadingScreenReady = true;
}

// Listen for when cards are displayed to update game state
window.addEventListener('cardsDisplayed', () => {
    updateGameDisplay();
});

loadDapp()

// Cleanup event monitoring when page is unloaded
window.addEventListener('beforeunload', () => {
    stopEventMonitoring()
})

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

        const centralizedGameState = getGameState()

        const pendingCommit = getStoredCommit();
        const pendingReveal = getPendingReveal();
        printLog(['debug'], "Pending commit:", pendingCommit);
        printLog(['debug'], "Pending reveal:", pendingReveal);

        if (centralizedGameState && centralizedGameState.gameState === 2n /* HashPosted */ && pendingCommit) {
            const result = calculateCards(pendingCommit.secret, centralizedGameState.houseRandomness);

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
                captureGameEvent('game_completed', {
                    game_id: centralizedGameState.gameId?.toString(),
                    player_card: result.playerCard,
                    house_card: result.houseCard,
                    total_time_ms: totalTime,
                    player_balance: centralizedGameState.playerETHBalance?.toString()
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

                captureGameEvent('reveal_transaction_success', {
                    game_id: centralizedGameState.gameId?.toString(),
                    player_card: result.playerCard,
                    house_card: result.houseCard
                });

                gameScene.playButton.unlockButton()

            } catch (error) {
                printLog(['error'], "Reveal failed:", error);

                captureGameEvent('reveal_transaction_failed', {
                    game_id: centralizedGameState.gameId?.toString(),
                    error: error.message
                });

                if (error.message && error.message.includes('already known')) {
                    printLog(['debug'], "Transaction already known, clearing pending reveal");
                    clearPendingReveal();
                }
            } finally {
                isTransactionInProgress = false;
            }
        }

        // Handle case where game is already revealed (state 3n) and there's a pending reveal
        if (centralizedGameState && centralizedGameState.gameState === 3n && pendingReveal) {
            printLog(['debug'], "Game already revealed, clearing pending reveal");
            clearPendingReveal();

            // Calculate and display the result
            if (centralizedGameState.playerCard && centralizedGameState.houseCard) {
                const playerCard = parseInt(centralizedGameState.playerCard);
                const houseCard = parseInt(centralizedGameState.houseCard);
                if (!isNaN(playerCard) && !isNaN(houseCard)) {
                    if (gameScene) {
                        gameScene.updateCardDisplay(playerCard, houseCard);
                    }
                }
            }
        }

        // Handle new game requests
        if (
            centralizedGameState && (
                centralizedGameState.gameState === 0n /* NotStarted */ ||
                centralizedGameState.gameState === 3n /* Revealed */ ||
                centralizedGameState.gameState === 4n /* Forfeited */)
            && shouldProcessCommit) {

            shouldProcessCommit = false;
            const storedCommit = getStoredCommit();

            if (storedCommit) {
                printLog(['debug'], "Found pending commit from previous game:", storedCommit);
                printLog(['debug'], "Clearing stale commit and proceeding...");
                clearStoredCommit();
                captureGameEvent('game_start_blocked_pending_commit', {
                    game_id: centralizedGameState.gameId?.toString()
                });
            }

            if (!gameState) {
                printLog(['error'], "Global game state not initialized");
                shouldProcessCommit = false;
                captureGameEvent('game_start_failed_uninitialized_state');

            } else if (BigInt(getPlayerETHBalance()) < BigInt(getMinimumPlayableBalance())) {
                printLog(['debug'], "Insufficient balance detected, UI will handle display");
                shouldProcessCommit = false;
                captureGameEvent('game_start_blocked_insufficient_balance', {
                    player_balance: getPlayerETHBalance(),
                    minimum_balance: getMinimumPlayableBalance()
                });

            } else if (centralizedGameState.gameState === 0n /* NotStarted */ ||
                centralizedGameState.gameState === 3n /* Revealed */ ||
                centralizedGameState.gameState === 4n /* Forfeited */) {
                printLog(['debug'], "=== STARTING COMMIT PROCESS ===");

                let secret, commitHash;
                if (precomputedSecret && precomputedHash) {
                    secret = precomputedSecret;
                    commitHash = precomputedHash;
                    precomputedSecret = null; // Clear after use
                    precomputedHash = null;
                    printLog(['debug'], "Using pre-computed commit (faster)");
                } else {
                    secret = generateRandomBytes32();
                    commitHash = keccak256(secret);
                    printLog(['debug'], "Computing commit on-the-fly");
                }

                storeCommit(secret);
                commitStartTime = Date.now();
                printLog(['profile'], "=== COMMIT REQUESTED ===");
                printLog(['profile'], "Start time:", new Date(commitStartTime).toISOString());

                printLog(['debug'], "Processing commit request...");

                // Track game start attempt
                captureGameEvent('game_start_attempted', {
                    game_id: centralizedGameState.gameId?.toString(),
                    player_balance: centralizedGameState.playerETHBalance?.toString(),
                    game_state: centralizedGameState.gameState?.toString()
                });

                // Mark transaction as in progress
                isTransactionInProgress = true;
                try {
                    await commit(commitHash);
                    shouldProcessCommit = false;
                    updateGameDisplay();
                    printLog(['debug'], "Commit transaction completed successfully");

                    precomputeNextCommit();

                    // Track successful commit
                    captureGameEvent('commit_transaction_success', {
                        game_id: centralizedGameState.gameId?.toString(),
                        player_balance: centralizedGameState.playerETHBalance?.toString()
                    });

                    printLog(['debug'], "Starting polling for HashPosted state...");
                    pollForHashPosted();

                } catch (error) {
                    printLog(['error'], "Commit failed:", error);
                    shouldProcessCommit = false;
                    
                    // Unlock the play button on error so user can try again
                    if (gameScene && gameScene.playButton) {
                        gameScene.playButton.unlockButton();
                    }

                    // Track commit failure
                    captureGameEvent('commit_transaction_failed', {
                        game_id: centralizedGameState.gameId?.toString(),
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
        updateGameDisplay();
        printLog(['debug'], "=== GAME LOOP END ===");
    } catch (error) {
        printLog(['error'], "Error in game loop:", error);
        shouldProcessCommit = false;
        isTransactionInProgress = false;

        // Track game loop error
        captureGameEvent('game_loop_error', {
            error: error.message
        });
        captureError(error, { function: 'gameLoop' });
    }
}

export async function updateGameDisplay() {
    try {
        const centralizedGameState = getGameState()
        if (!centralizedGameState) return;
        const wallet = getLocalWallet()
        // Only update display if wallet is connected
        if (!wallet) return;
        // Use the game scene reference instead of hardcoded index
        if (gameScene) {
            gameScene.updateDisplay(centralizedGameState.playerETHBalance, centralizedGameState.playerGachaTokenBalance, wallet.address, centralizedGameState);
        }
    } catch (error) {
        console.error("Error updating game state:", error);
    }
}

function startGameLoop() {
    gameLoop();
    setInterval(gameLoop, GAME_LOOP_INTERVAL);
}

/**
 * Poll for game state to change to HashPosted (state 2)
 * This is a fallback mechanism in case WebSocket events don't fire
 */
async function pollForHashPosted() {
    const POLL_INTERVAL = 100; // ms
    const MAX_POLL_TIME = 30000; // 30 seconds max
    const startTime = Date.now();
    
    printLog(['debug'], "=== POLL FOR HASHPOSTED START ===");
    
    const poll = async () => {
        try {
            const elapsed = Date.now() - startTime;
            if (elapsed > MAX_POLL_TIME) {
                printLog(['error'], "Polling timeout - game state did not change to HashPosted");
                captureGameEvent('hashposted_poll_timeout', {
                    elapsed_ms: elapsed
                });
                return;
            }
            
            // Fetch fresh game state from blockchain
            const freshState = await checkGameState();
            if (!freshState) {
                printLog(['debug'], "Poll: No game state returned, retrying...");
                setTimeout(poll, POLL_INTERVAL);
                return;
            }
            
            printLog(['debug'], `Poll: Current game state = ${freshState.gameState}`);
            
            // Check if state changed to HashPosted (2) or beyond
            if (freshState.gameState >= 2n) {
                printLog(['debug'], `Poll: State changed to ${freshState.gameState}, updating game state`);
                printLog(['profile'], "=== HASHPOSTED DETECTED ===");
                printLog(['profile'], "Time from commit to HashPosted:", Date.now() - startTime, "ms");
                printLog(['profile'], "===========================");
                
                // Update the centralized game state
                updateGameState(freshState);
                
                captureGameEvent('hashposted_detected', {
                    elapsed_ms: elapsed,
                    game_state: freshState.gameState.toString()
                });
                
                return; // Stop polling
            }
            
            // State not yet HashPosted, continue polling
            setTimeout(poll, POLL_INTERVAL);
        } catch (error) {
            printLog(['error'], "Poll error:", error);
            // Continue polling even on error
            setTimeout(poll, POLL_INTERVAL);
        }
    };
    
    // Start polling
    poll();
}

function storeCommit(secret) {
    printLog(['debug'], "=== STORE COMMIT ===");
    printLog(['debug'], "Previous commit:", getStoredCommit());
    printLog(['debug'], "New commit:", secret);
    // Note: commitment hash will be calculated in the commit function
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

    if (gameScene.cardDisplay.currentPlayerCard !== null && gameScene.cardDisplay.currentHouseCard !== null) {
        gameScene.gameHistory.updateLastGameInHistory(gameScene.cardDisplay.currentPlayerCard, gameScene.cardDisplay.currentHouseCard);
    }

    gameScene.gameHistory.addPendingGameToHistory();

    setTimeout(() => {
        updateGameDisplay();
    }, 100);

    captureGameEvent('commit_game_called', {
        timestamp: Date.now()
    });
}

