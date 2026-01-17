import { loadPhaser } from './game.js';
import posthog from 'posthog-js';
import { printLog } from './utils/utils.js';
import {
    initWeb3,
    getLocalWallet,
    checkGameState,
    checkInitialGameState,
    rollDice,
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
const GAME_LOOP_INTERVAL = 100;
let gameStartTime = null;

let gameState = null;
let shouldProcessGame = false;

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
let lastDisplayedGameId = null; // Track last displayed game to avoid duplicates

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

        await new Promise(resolve => setTimeout(resolve, 150));
        gameDataLoadingProgress = 1;
        isGameDataReady = true;
        updateGameDataProgress(1);
        console.log("Starting game loop...")
        await warmupSdkAndCrypto();
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

        // Handle game request - VRF flow is much simpler
        // State 0: NotStarted, State 1: Pending, State 2: Completed
        if (
            centralizedGameState && (
                centralizedGameState.gameState === 0n /* NotStarted */ ||
                centralizedGameState.gameState === 2n /* Completed */)
            && shouldProcessGame) {

            shouldProcessGame = false;

            if (!gameState) {
                printLog(['error'], "Global game state not initialized");
                shouldProcessGame = false;
                captureGameEvent('game_start_failed_uninitialized_state');

            } else if (BigInt(getPlayerETHBalance()) < BigInt(getMinimumPlayableBalance())) {
                printLog(['debug'], "Insufficient balance detected, UI will handle display");
                shouldProcessGame = false;
                captureGameEvent('game_start_blocked_insufficient_balance', {
                    player_balance: getPlayerETHBalance(),
                    minimum_balance: getMinimumPlayableBalance()
                });

            } else {
                printLog(['debug'], "=== STARTING ROLL DICE ===");

                gameStartTime = Date.now();

                // Track game start attempt
                captureGameEvent('game_start_attempted', {
                    game_id: centralizedGameState.gameId?.toString(),
                    player_balance: centralizedGameState.playerETHBalance?.toString(),
                    game_state: centralizedGameState.gameState?.toString()
                });

                // Mark transaction as in progress
                isTransactionInProgress = true;
                try {
                    await rollDice();
                    shouldProcessGame = false;
                    updateGameDisplay();
                    printLog(['debug'], "rollDice transaction completed successfully");

                    // Track successful roll
                    captureGameEvent('rollDice_transaction_success', {
                        game_id: centralizedGameState.gameId?.toString(),
                        player_balance: centralizedGameState.playerETHBalance?.toString()
                    });

                    // WebSocket event listener will handle game completion

                } catch (error) {
                    printLog(['error'], "rollDice failed:", error);
                    shouldProcessGame = false;

                    // Unlock the play button on error so user can try again
                    if (gameScene && gameScene.playButton) {
                        gameScene.playButton.unlockButton();
                    }

                    // Track rollDice failure
                    captureGameEvent('rollDice_transaction_failed', {
                        game_id: centralizedGameState.gameId?.toString(),
                        error: error.message
                    });
                } finally {
                    isTransactionInProgress = false;
                }
            }
        }

        // Handle completed game display
        if (centralizedGameState && centralizedGameState.gameState === 2n /* Completed */) {
            // If we have card values and haven't displayed them yet
            if (centralizedGameState.playerCard && centralizedGameState.houseCard && 
                centralizedGameState.playerCard > 0n && centralizedGameState.houseCard > 0n) {
                
                // Get current gameId (convert to string for comparison)
                const currentGameId = centralizedGameState.gameId?.toString();
                
                // Only display if this is a NEW game (different from last displayed)
                // AND we have a pending game start AND no animation is running
                const isNewGame = currentGameId && currentGameId !== lastDisplayedGameId;
                const isAnimationInProgress = gameScene?.cardDisplay?.isAnimating || 
                                              gameScene?.tieSequence?.isActive ||
                                              gameScene?.tieSequence?.bigWinAnimation?.isActive;
                
                if (gameStartTime && !isAnimationInProgress && isNewGame) {
                    const endTime = Date.now();
                    const totalTime = endTime - gameStartTime;
                    printLog(['profile'], "=== PERFORMANCE METRICS ===");
                    printLog(['profile'], "Total time from roll to result:", totalTime, "ms");
                    printLog(['profile'], "Game ID:", currentGameId);
                    printLog(['profile'], "Start time:", new Date(gameStartTime).toISOString());
                    printLog(['profile'], "End time:", new Date(endTime).toISOString());
                    printLog(['profile'], "=========================");
                    gameStartTime = null;
                    lastDisplayedGameId = currentGameId; // Mark this game as displayed

                    // Track game completion performance
                    captureGameEvent('game_completed', {
                        game_id: currentGameId,
                        player_card: Number(centralizedGameState.playerCard),
                        house_card: Number(centralizedGameState.houseCard),
                        total_time_ms: totalTime,
                        player_balance: centralizedGameState.playerETHBalance?.toString()
                    });

                    // Display the cards
                    if (gameScene) {
                        gameScene.updateCardDisplay(
                            Number(centralizedGameState.playerCard), 
                            Number(centralizedGameState.houseCard)
                        );
                        gameScene.playButton.unlockButton();
                    }
                }
            }
        }

        updateGameDisplay();
        printLog(['debug'], "=== GAME LOOP END ===");
    } catch (error) {
        printLog(['error'], "Error in game loop:", error);
        shouldProcessGame = false;
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

export async function playGame() {
    // Prevent multiple rapid clicks
    if (isTransactionInProgress || shouldProcessGame) {
        printLog(['debug'], "Play blocked - transaction in progress or game pending");
        return;
    }

    // Force close any active tie sequence or big win animation
    if (gameScene) {
        if (gameScene.tieSequence?.bigWinAnimation?.isActive) {
            printLog(['debug'], "Force closing big win animation for new game");
            gameScene.tieSequence.bigWinAnimation.closeBigWinAnimation();
        }
        if (gameScene.tieSequence?.isActive) {
            printLog(['debug'], "Force closing tie sequence for new game");
            gameScene.tieSequence.closeTieSequence();
        }
    }

    // If card animation is in progress, complete the history update first
    if (gameScene && gameScene.cardDisplay) {
        // If there are pending card values that haven't been recorded yet, record them now
        // Use proper check for both null and undefined
        const hasPlayerCard = gameScene.cardDisplay.currentPlayerCard != null;
        const hasHouseCard = gameScene.cardDisplay.currentHouseCard != null;

        if (hasPlayerCard && hasHouseCard) {
            printLog(['debug'], "Completing pending history update before new game:",
                gameScene.cardDisplay.currentPlayerCard, gameScene.cardDisplay.currentHouseCard);
            gameScene.gameHistory.updateLastGameInHistory(
                gameScene.cardDisplay.currentPlayerCard,
                gameScene.cardDisplay.currentHouseCard
            );
        }

        // Now clear sprites and reset state
        gameScene.cardDisplay.clearCardSprites();
        gameScene.cardDisplay.currentPlayerCard = null;
        gameScene.cardDisplay.currentHouseCard = null;
    }

    shouldProcessGame = true;

    // Add pending game entry to history
    if (gameScene && gameScene.gameHistory) {
        gameScene.gameHistory.addPendingGameToHistory();
    }

    setTimeout(() => {
        updateGameDisplay();
    }, 100);

    captureGameEvent('play_game_called', {
        timestamp: Date.now()
    });
}
