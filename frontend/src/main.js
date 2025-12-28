import { loadPhaser } from './game.js';
import posthog from 'posthog-js';
import { generateRandomBytes32, calculateCards, printLog } from './utils/utils.js';
import { keccak256 } from 'viem'; // Static import for performance - no more dynamic import
import {
    initWeb3,
    getLocalWallet,
    checkGameState,
    checkInitialGameState,
    commit,
    performReveal,
    startEventMonitoring,
    stopEventMonitoring,
    connectWallet
} from './web3/blockchain_stuff.js';

// Import session key utilities for UI status
import {
    hasUsableSessionKey,
    getActiveSessionKey,
    getSessionKeyTimeRemaining
} from './web3/sessionKeyManager.js';

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

var game
var gameScene = null; // Reference to the main game scene

const MIN_BALANCE = "0.00001";
const GAME_LOOP_INTERVAL = 50;
let commitStartTime = null;

let gameState = null;
let shouldProcessCommit = false;

// ⚡ PERFORMANCE: Pre-computed commit data (ready before user clicks)
let precomputedSecret = null;
let precomputedHash = null;

/**
 * Pre-compute next commit data for faster game start
 * Called after each game completes or during idle time
 */
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
        // Update progress to show Web3 is starting
        web3LoadingProgress = 0.1;
        updateWeb3Progress(0.1);

        // Initialize Web3
        const result = await initWeb3();

        if (result.wallet) {
            console.log("Wallet already connected:", result.wallet);
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
        // ⚡ PERFORMANCE: Pre-compute first commit while player looks at UI
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

                // Track reveal failure
                captureGameEvent('reveal_transaction_failed', {
                    game_id: centralizedGameState.gameId?.toString(),
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

                // ⚡ PERFORMANCE: Use pre-computed secret/hash if available
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

                    // ⚡ PERFORMANCE: Pre-compute next commit while user plays
                    precomputeNextCommit();

                    // Track successful commit
                    captureGameEvent('commit_transaction_success', {
                        game_id: centralizedGameState.gameId?.toString(),
                        player_balance: centralizedGameState.playerETHBalance?.toString()
                    });

                } catch (error) {
                    printLog(['error'], "Commit failed:", error);
                    shouldProcessCommit = false;

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

function showConnectButton() {
    // Create container for proper centering and overlay effect
    const container = document.createElement('div');
    container.id = 'connect-wallet-container';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.85)'; // Dark overlay
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.zIndex = '9999';
    container.style.backdropFilter = 'blur(5px)';

    const content = document.createElement('div');
    content.style.textAlign = 'center';
    content.style.padding = '40px';
    content.style.border = '2px solid #00f3ff'; // Cyan neon border
    content.style.borderRadius = '15px';
    content.style.boxShadow = '0 0 20px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(0, 243, 255, 0.1)';
    content.style.background = 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,30,0.95))';
    content.style.maxWidth = '400px';

    const title = document.createElement('h2');
    title.innerText = 'INITIALIZE LINK';
    title.style.color = '#00f3ff';
    title.style.fontFamily = '"Orbitron", sans-serif';
    title.style.fontSize = '24px';
    title.style.marginBottom = '10px';
    title.style.textShadow = '0 0 10px rgba(0, 243, 255, 0.8)';
    title.style.letterSpacing = '2px';

    const subtitle = document.createElement('p');
    subtitle.innerText = 'Secure connection required to access Meteoro terminal.';
    subtitle.style.color = '#aaaaaa';
    subtitle.style.fontFamily = '"Orbitron", sans-serif';
    subtitle.style.fontSize = '12px';
    subtitle.style.marginBottom = '20px';
    subtitle.style.lineHeight = '1.5';

    // Session key info message
    const sessionInfo = document.createElement('p');
    sessionInfo.innerText = '⚡ Session keys enable popup-free gameplay';
    sessionInfo.style.color = '#00ff88';
    sessionInfo.style.fontFamily = '"Orbitron", sans-serif';
    sessionInfo.style.fontSize = '10px';
    sessionInfo.style.marginBottom = '30px';
    sessionInfo.style.lineHeight = '1.5';
    sessionInfo.style.opacity = '0.8';

    const btn = document.createElement('button');
    btn.innerText = 'CONNECT WALLET';
    btn.id = 'connect-wallet-btn';
    btn.style.padding = '15px 40px';
    btn.style.fontSize = '18px';
    btn.style.cursor = 'pointer';
    btn.style.backgroundColor = 'rgba(0, 243, 255, 0.1)';
    btn.style.color = '#00f3ff';
    btn.style.border = '1px solid #00f3ff';
    btn.style.borderRadius = '5px';
    btn.style.fontFamily = '"Orbitron", sans-serif';
    btn.style.transition = 'all 0.3s ease';
    btn.style.textTransform = 'uppercase';
    btn.style.letterSpacing = '1px';
    btn.style.boxShadow = '0 0 10px rgba(0, 243, 255, 0.2)';

    // Hover effect
    btn.onmouseover = () => {
        btn.style.backgroundColor = 'rgba(0, 243, 255, 0.3)';
        btn.style.boxShadow = '0 0 20px rgba(0, 243, 255, 0.6)';
    };
    btn.onmouseout = () => {
        btn.style.backgroundColor = 'rgba(0, 243, 255, 0.1)';
        btn.style.boxShadow = '0 0 10px rgba(0, 243, 255, 0.2)';
    };

    btn.onclick = async () => {
        try {
            btn.innerText = 'ESTABLISHING...';
            btn.style.opacity = '0.7';
            btn.style.cursor = 'wait';

            const wallet = await connectWallet();
            if (wallet) {
                // Check if session key was created
                const hasSession = hasUsableSessionKey();

                if (hasSession) {
                    btn.innerText = '⚡ SESSION ACTIVE';
                    sessionInfo.innerText = 'Popup-free mode enabled!';
                    sessionInfo.style.color = '#00ff00';
                } else {
                    btn.innerText = 'LINK ESTABLISHED';
                    sessionInfo.innerText = 'Connected (passkey mode)';
                    sessionInfo.style.color = '#ffaa00';
                }

                btn.style.borderColor = '#00ff00';
                btn.style.color = '#00ff00';
                btn.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';

                setTimeout(() => {
                    container.style.transition = 'opacity 0.5s ease';
                    container.style.opacity = '0';
                    setTimeout(() => {
                        container.remove();
                        // Create session key status indicator in the UI
                        createSessionKeyIndicator();
                    }, 500);
                    window.location.reload();
                }, 1500);
            }
        } catch (e) {
            btn.innerText = 'CONNECTION FAILED';
            btn.style.borderColor = '#ff0000';
            btn.style.color = '#ff0000';
            btn.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
            console.error(e);

            setTimeout(() => {
                btn.innerText = 'RETRY CONNECTION';
                btn.style.borderColor = '#00f3ff';
                btn.style.color = '#00f3ff';
                btn.style.boxShadow = '0 0 10px rgba(0, 243, 255, 0.2)';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }, 2000);
        }
    };

    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(sessionInfo);
    content.appendChild(btn);
    container.appendChild(content);
    document.body.appendChild(container);
}

/**
 * Create a small indicator showing session key status in the corner
 * This helps users know if they're in popup-free mode
 */
function createSessionKeyIndicator() {
    // Remove existing indicator if any
    const existing = document.getElementById('session-key-indicator');
    if (existing) existing.remove();

    const sessionKey = getActiveSessionKey();
    if (!sessionKey) return;

    const timeRemaining = getSessionKeyTimeRemaining(sessionKey);
    if (timeRemaining.expired) return;

    const indicator = document.createElement('div');
    indicator.id = 'session-key-indicator';
    indicator.style.position = 'fixed';
    indicator.style.bottom = '10px';
    indicator.style.right = '10px';
    indicator.style.padding = '8px 12px';
    indicator.style.backgroundColor = 'rgba(0, 255, 136, 0.15)';
    indicator.style.border = '1px solid #00ff88';
    indicator.style.borderRadius = '5px';
    indicator.style.color = '#00ff88';
    indicator.style.fontFamily = '"Orbitron", sans-serif';
    indicator.style.fontSize = '10px';
    indicator.style.zIndex = '1000';
    indicator.style.backdropFilter = 'blur(5px)';
    indicator.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.2)';

    const updateIndicator = () => {
        const key = getActiveSessionKey();
        if (!key) {
            indicator.remove();
            return;
        }
        const remaining = getSessionKeyTimeRemaining(key);
        if (remaining.expired) {
            indicator.innerHTML = '⚠️ Session Expired';
            indicator.style.borderColor = '#ff6600';
            indicator.style.color = '#ff6600';
            indicator.style.backgroundColor = 'rgba(255, 102, 0, 0.15)';
        } else {
            indicator.innerHTML = `⚡ Session: ${remaining.hours}h ${remaining.minutes % 60}m`;
        }
    };

    updateIndicator();
    // Update every minute
    setInterval(updateIndicator, 60000);

    document.body.appendChild(indicator);
}
