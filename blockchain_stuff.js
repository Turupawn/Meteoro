const NETWORK_ID = 6342

const POLL_INTERVAL = 150

const MY_CONTRACT_ADDRESS = "0xcf96BBf8932689C98940cb3e8D4750E6632f4005"
const MY_CONTRACT_ABI_PATH = "./json_abi/MyContract.json"
var my_contract

var web3

// Add at the top with other global variables
const DEBUG_LOGS = false; // Controls general debug logging
const PROFILE_LOGS = true; // Controls performance profiling logs
const processingGameIds = new Set(); // Track games being processed
const MIN_BALANCE = "0.00000001"; // Minimum balance required in ETH
let commitStartTime = null;

const PRINT_LEVELS = ['debug', 'profile', 'error'];

const getWeb3 = async () => {
  return new Promise((resolve, reject) => {
    const provider = new Web3.providers.HttpProvider("https://carrot.megaeth.com/rpc");
    const web3 = new Web3(provider);
    resolve(web3);
  });
};

const getContract = async (web3, address, abi_path) => {
  const response = await fetch(abi_path);
  const data = await response.json();
  contract = new web3.eth.Contract(
    data,
    address
    );
  return contract
}

async function loadDapp() {
  var awaitWeb3 = async function () {
    web3 = await getWeb3()
        var awaitContract = async function () {
      try {
          my_contract = await getContract(web3, MY_CONTRACT_ADDRESS, MY_CONTRACT_ABI_PATH)
        let wallet = getLocalWallet();
        if (!wallet) {
          wallet = generateWallet();
        }
        onContractInitCallback();
        
      } catch (error) {
        console.error("Error initializing contract:", error);
        document.getElementById("game-status").textContent = "Error connecting to blockchain";
      }
    };
    awaitContract();
  };
  awaitWeb3();
}

loadDapp()

const onContractInitCallback = async () => {
  try {
    await checkLocalWalletBalance();
    updateGameState();
    startGameLoop();
  } catch (error) {
    console.error("Error in contract initialization:", error);
    const personalGamesList = document.getElementById("personal-games-list");
    if (personalGamesList) {
      personalGamesList.innerHTML = "<li>Error loading games</li>";
    } else {
      console.error("Cannot find personal-games-list element");
    }
  }
}

function generateRandomBytes32() {
    return web3.utils.randomHex(32);
}

function storeSecret(secret) {
    printLog(['debug'], "=== STORE SECRET ===");
    printLog(['debug'], "Previous secret:", getStoredSecret());
    printLog(['debug'], "New secret:", secret);
    printLog(['debug'], "Commitment:", web3.utils.soliditySha3(secret));
    localStorage.setItem('playerSecret', JSON.stringify({
        secret: secret,
        timestamp: Date.now()
    }));
    printLog(['debug'], "Stored secret:", getStoredSecret());
    printLog(['debug'], "===================");
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
}

function getCardDisplay(cardValue) {
    if (cardValue === 1) return "A";
    if (cardValue === 11) return "J";
    if (cardValue === 12) return "Q";
    if (cardValue === 13) return "K";
    return cardValue.toString();
}

function updateCardDisplay(playerCard, houseCard) {
    document.getElementById("player-card").textContent = getCardDisplay(playerCard);
    document.getElementById("house-card").textContent = getCardDisplay(houseCard);
    
    if (playerCard > houseCard) {
        document.getElementById("game-status").textContent = "You won!";
        document.getElementById("game-status").style.color = "#28a745"; // Green
    } else {
        document.getElementById("game-status").textContent = "House wins";
        document.getElementById("game-status").style.color = "#dc3545"; // Red
    }
}

function resetCardDisplay() {
    document.getElementById("player-card").textContent = "0";
    document.getElementById("house-card").textContent = "0";
    document.getElementById("game-status").textContent = "";
}

async function gameLoop() {
    const wallet = getLocalWallet();
    if (!wallet) {
        printLog(['debug'], "No wallet found, skipping game loop");
        return;
    }

    try {
        printLog(['debug'], "=== GAME LOOP START ===");

        await checkLocalWalletBalance();

        const gameState = await checkGameState();
        printLog(['debug'], "Current game state:", gameState);
        
        const secretData = getStoredSecret();
        printLog(['debug'], "Secret in storage:", secretData);
        
        if (gameState.gameState === "2" && !secretData) {
            printLog(['error'], "=== CRITICAL STATE DETECTED ===");
            printLog(['error'], "Game is in HashPosted state but no secret found!");
            printLog(['error'], "Game state:", gameState);
            printLog(['error'], "Local storage state:", {
                secret: getStoredSecret(),
                wallet: getLocalWallet()
            });
            printLog(['error'], "========================");
        }
        
        if(secretData) {
            printLog(['debug'], "Secret:",{secret: secretData.secret, commitment: web3.utils.soliditySha3(secretData.secret)})
        } else {
            printLog(['debug'], "No secret data found")
        }

        if(wallet) {
            const balance = await web3.eth.getBalance(wallet.address);
            const ethBalance = web3.utils.fromWei(balance, 'ether');
            printLog(['debug'], "Wallet:",{address: wallet.address, privateKey: wallet.privateKey, balance: ethBalance})
        } else {
            printLog(['debug'], "No wallet found")
        }
        
        if (gameState.gameState === "2" &&
            secretData &&
            !processingGameIds.has(gameState.gameId)) {
            const result = calculateCards(secretData.secret, gameState.houseHash);
            
            updateCardDisplay(result.playerCard, result.houseCard);
            
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

            printLog(['debug'], "Conditions met for reveal, attempting...");
            await performReveal(wallet, secretData.secret);
        }
        
        printLog(['debug'], "=== GAME LOOP END ===");
    } catch (error) {
        printLog(['error'], "Error in game loop:", error);
    }
}

async function commit() {
    const wallet = getLocalWallet();
    if (!wallet) {
        alert("No local wallet found!");
        return;
    }

    try {
        commitStartTime = Date.now();
        printLog(['profile'], "=== COMMIT STARTED ===");
        printLog(['profile'], "Start time:", new Date(commitStartTime).toISOString());

        const balance = await web3.eth.getBalance(wallet.address);
        const stakeAmount = await my_contract.methods.STAKE_AMOUNT().call();

        if (BigInt(balance) < BigInt(web3.utils.toWei(MIN_BALANCE, 'ether'))) {
            const currentEth = web3.utils.fromWei(balance, 'ether');
            alert(`Insufficient balance! You need at least ${MIN_BALANCE} ETH to play.\nCurrent balance: ${parseFloat(currentEth).toFixed(6)} ETH`);
            return;
        }
        
        const storedSecret = getStoredSecret();
        if (storedSecret) {
            printLog(['debug'], "Found stored secret from previous game:", storedSecret);
            alert("Cannot start new game while previous game's secret is still stored. Please wait for the current game to complete.");
            return;
        }

        const gameState = await my_contract.methods.getGameState(wallet.address).call();
        printLog(['debug'], "Game state:", gameState);

        if (gameState.gameState !== "0") { // NotStarted
            alert("You have already committed to this game!");
            return;
        }

        resetCardDisplay();
        document.getElementById("game-status").textContent = "Please wait...";

        const secret = generateRandomBytes32();
        storeSecret(secret);
        const commitHash = web3.utils.soliditySha3(secret);
        
        const data = my_contract.methods.commit(commitHash).encodeABI();
        const nonce = await web3.eth.getTransactionCount(wallet.address, 'latest');
        const gasPrice = await web3.eth.getGasPrice();
        
        const tx = {
            from: wallet.address,
            to: MY_CONTRACT_ADDRESS,
            nonce: nonce,
            gasPrice: gasPrice,
            gas: 300000,
            value: stakeAmount,
            data: data
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        printLog(['debug'], "Commit Transaction Receipt:", {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });
        
        await checkLocalWalletBalance();
        updateGameState();
    } catch (error) {
        printLog(['error'], "Error in commit:", error);
        document.getElementById("game-status").textContent = "";
        commitStartTime = null;
    }
}

// Update checkGameState function
async function checkGameState() {
    try {
        const wallet = getLocalWallet();
        if (!wallet) return null;
        const gameState = await my_contract.methods.getGameState(wallet.address).call({}, 'pending');
        return {
            gameState: gameState.gameState,
            playerCommit: gameState.playerCommit,
            houseHash: gameState.houseHash,
            gameId: gameState.gameId
        };
    } catch (error) {
        console.error("Error checking game state:", error);
        return null;
    }
}

function calculateCards(secret, houseHash) {
    const secretBig = BigInt(secret);
    const houseHashBig = BigInt(houseHash);
    const xorResult = secretBig ^ houseHashBig;
    const playerCard = Number((xorResult >> 128n) % 13n) + 1;
    const houseCard = Number((xorResult & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn) % 13n) + 1;
    let winner;
    if (playerCard > houseCard) {
        winner = 'Player';
    } else {
        winner = 'House';
    }
    return { playerCard, houseCard, winner };
}

async function updateGameState() {
    try {
        const wallet = getLocalWallet();
        if (!wallet) return;

        // Use 'pending' block tag to get latest state including mini blocks
        const gameState = await my_contract.methods.getGameState(wallet.address).call({}, 'pending');
        
        // Update current game state display
        const gameStateElement = document.getElementById("game-state");
        if (gameStateElement) {
            let stateText = `Game State: ${gameState.gameState}`;
            // Add warning if we're in HashPosted state but have no secret
            if (gameState.gameState === "2" && !getStoredSecret()) {
                stateText += " (Secret lost - can forfeit)";
            }
            gameStateElement.textContent = stateText;
        }

        // Update personal games list with history
        const personalGamesList = document.getElementById("personal-games-list");
        if (personalGamesList) {
            personalGamesList.innerHTML = ""; // Clear the list
            
            if (gameState.recentHistory.length === 0) {
                personalGamesList.innerHTML = "<li>No games yet</li>";
            } else {
                // Display games in reverse chronological order (newest first)
                for (let i = gameState.recentHistory.length - 1; i >= 0; i--) {
                    const result = gameState.recentHistory[i];
                    const isForfeit = result.playerCard === 0 && result.houseCard === 0;
                    const playerCard = getCardDisplay(parseInt(result.playerCard));
                    const houseCard = getCardDisplay(parseInt(result.houseCard));
                    const isWin = result.winner.toLowerCase() === wallet.address.toLowerCase();
                    
                    addGameToPersonalList(playerCard, houseCard, isWin, isForfeit);
                }
            }
        }
    } catch (error) {
        console.error("Error updating game state:", error);
    }
}

// Start the game loop
function startGameLoop() {
    // Run immediately
    gameLoop();
    // Then run every 500ms instead of 2000ms since we're using pending block tag
    setInterval(gameLoop, POLL_INTERVAL);
}

const onWalletConnectedCallback = async () => {
}

//// Functions ////

function generateWallet() {
  const account = web3.eth.accounts.create();
  localStorage.setItem('localWallet', JSON.stringify({
    address: account.address,
    privateKey: account.privateKey
  }));
  return account;
}

function getLocalWallet() {
  const walletData = localStorage.getItem('localWallet');
  if (walletData) {
    return JSON.parse(walletData);
  }
  return null;
}

// Update the checkLocalWalletBalance function to be simpler
async function checkLocalWalletBalance() {
    const wallet = getLocalWallet();
    if (wallet) {
        const balance = await web3.eth.getBalance(wallet.address);
        const ethBalance = web3.utils.fromWei(balance, 'ether');

        // Simple display without CSS
        document.getElementById("balance-display").textContent =
            `Balance: ${parseFloat(ethBalance).toFixed(6)} ETH`;
    }
}

async function forfeit() {
    const wallet = getLocalWallet();
    if (!wallet) {
        alert("No local wallet found!");
        return;
    }

    try {
        const data = my_contract.methods.forfeit().encodeABI();
        const nonce = await web3.eth.getTransactionCount(wallet.address, 'latest');
        const gasPrice = await web3.eth.getGasPrice();
        
        const tx = {
            from: wallet.address,
            to: MY_CONTRACT_ADDRESS,
            nonce: nonce,
            gasPrice: gasPrice,
            gas: 300000,
            data: data
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        printLog(['debug'], "Forfeit Transaction Receipt:", {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });

        if (receipt.status) {
            window.location.reload();
        } else {
            updateGameState();
        }
    } catch (error) {
        printLog(['error'], "Error in forfeit:", error);
    }
}

// Update the performReveal function
async function performReveal(wallet, secret) {
    try {
        printLog(['debug'], "=== PERFORM REVEAL START ===");
        printLog(['debug'], "Current secret in storage:", getStoredSecret());
        
        const gameState = await my_contract.methods.getGameState(wallet.address).call({}, 'pending');
        const gameId = gameState.gameId;
        printLog(['debug'], "Game state at reveal start:", {
            gameId: gameId,
            gameState: gameState.gameState,
            playerCommit: gameState.playerCommit,
            houseHash: gameState.houseHash
        });

        if (processingGameIds.has(gameId)) {
            printLog(['debug'], `Already processing game ${gameId}, skipping reveal`);
            return;
        }

        processingGameIds.add(gameId);
        printLog(['debug'], `Started processing reveal for game ${gameId}`);

        const data = my_contract.methods.reveal(secret).encodeABI();
        const nonce = await web3.eth.getTransactionCount(wallet.address, 'latest');
        const gasPrice = await web3.eth.getGasPrice();
        
        const tx = {
            from: wallet.address,
            to: MY_CONTRACT_ADDRESS,
            nonce: nonce,
            gasPrice: gasPrice,
            gas: 300000,
            data: data
        };

        printLog(['debug'], "Sending reveal transaction...");
        const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        printLog(['debug'], "Reveal Transaction Receipt:", {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });

        if (receipt.status) {
            printLog(['debug'], "=== REVEAL SUCCESSFUL ===");
            printLog(['debug'], "Secret in storage before state check:", getStoredSecret());
            
            const currentGameState = await my_contract.methods.getGameState(wallet.address).call({}, 'pending');
            printLog(['debug'], "Game state after reveal:", {
                gameId: currentGameState.gameId,
                gameState: currentGameState.gameState,
                playerCommit: currentGameState.playerCommit,
                houseHash: currentGameState.houseHash
            });
            
            if (currentGameState.gameId === gameId && 
                currentGameState.gameState === "0" && 
                currentGameState.playerCommit === "0x0000000000000000000000000000000000000000000000000000000000000000") {
                printLog(['debug'], "Same game ID, completed state, and zero commit - clearing secret");
                clearStoredSecret();
            } else {
                printLog(['debug'], "Game state changed or new game started, keeping secret");
            }
        } else {
            printLog(['debug'], "Reveal failed");
            processingGameIds.delete(gameId);
        }
        
        printLog(['debug'], "=== PERFORM REVEAL END ===");
        updateGameState();
    } catch (error) {
        printLog(['error'], "Error in reveal:", error);
        const gameState = await my_contract.methods.getGameState(wallet.address).call({}, 'pending');
        processingGameIds.delete(gameState.gameId);
    }
}

async function withdrawFunds() {
    const wallet = getLocalWallet();
    if (!wallet) {
        alert("No local wallet found!");
        return;
    }

    try {
        const balance = await web3.eth.getBalance(wallet.address);
        if (balance <= 0) {
            alert("No funds to withdraw!");
            return;
        }

        const ethLeftForGas = web3.utils.toWei("0.000000001", "ether");
        
        if (BigInt(balance) <= BigInt(ethLeftForGas)) {
            alert("Balance too low! Leaving funds for gas fees.");
            return;
        }

        const destinationAddress = prompt("Enter the wallet address to withdraw funds to:");
        
        if (!destinationAddress || !web3.utils.isAddress(destinationAddress)) {
            alert("Invalid Ethereum address!");
            return;
        }
        const gasPrice = await web3.eth.getGasPrice();
        const gasLimit = 21000;
        const gasCost = BigInt(gasPrice) * BigInt(gasLimit);
        const amountToSend = BigInt(balance) - gasCost - BigInt(ethLeftForGas);
        if (amountToSend <= 0) {
            alert("Balance too low to withdraw after reserving gas fees!");
            return;
        }
        const tx = {
            from: wallet.address,
            to: destinationAddress,
            value: amountToSend.toString(),
            gas: gasLimit,
            gasPrice: gasPrice,
            nonce: await web3.eth.getTransactionCount(wallet.address, 'latest')
        };
        const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        document.getElementById("game-status").textContent = "Withdrawing...";
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        if (receipt.status) {
            const ethAmount = web3.utils.fromWei(amountToSend.toString(), 'ether');
            const leftAmount = web3.utils.fromWei(ethLeftForGas, 'ether');
            alert(`Successfully withdrew ${ethAmount} ETH to ${destinationAddress}\nLeft ${leftAmount} ETH for future gas fees`);
            document.getElementById("game-status").textContent = "";
            checkLocalWalletBalance();
        } else {
            alert("Withdrawal failed!");
            document.getElementById("game-status").textContent = "";
        }
    } catch (error) {
        printLog(['error'], "Error withdrawing funds:", error);
        alert("Error withdrawing funds: " + error.message);
        document.getElementById("game-status").textContent = "";
    }
}

function addGameToPersonalList(playerCard, houseCard, isWin, isForfeit = false) {
  const gamesList = document.getElementById("personal-games-list");
  const listItem = document.createElement("li");
  listItem.style.marginBottom = "8px";
  
  if (isForfeit) {
    listItem.innerHTML = `<span style="color: #dc3545;">• Game forfeited</span>`;
  } else if (isWin) {
    listItem.innerHTML = `<span style="color: #28a745;">• You won [${playerCard}-${houseCard}]</span>`;
  } else {
    listItem.innerHTML = `<span style="color: #dc3545;">• House wins [${playerCard}-${houseCard}]</span>`;
  }
  
  if (gamesList.firstChild) {
    gamesList.insertBefore(listItem, gamesList.firstChild);
  } else {
    gamesList.appendChild(listItem);
  }
}

function printLog(levels, ...args) {
    if (!Array.isArray(levels)) levels = [levels];
    const shouldPrint = levels.some(level => PRINT_LEVELS.includes(level));
    if (!shouldPrint) return;
    if (levels.includes('error')) {
        console.error(...args);
    } else {
        console.log(...args);
    }
}