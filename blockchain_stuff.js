const NETWORK_ID = 6342

const MY_CONTRACT_ADDRESS = "0x862A40C84E1A092363C3b87d492B8fCee3f9292E"
const MY_CONTRACT_ABI_PATH = "./json_abi/MyContract.json"
var my_contract

var web3

// Simplify web3 initialization without MetaMask
const getWeb3 = async () => {
  return new Promise((resolve, reject) => {
    // Use an RPC provider directly instead of MetaMask
    const provider = new Web3.providers.HttpProvider("https://carrot.megaeth.com/rpc"); // Using a public RPC endpoint
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
        
        // Check for local wallet
        let wallet = getLocalWallet();
        if (!wallet) {
          wallet = generateWallet();
        }
        
        checkLocalWalletBalance();
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
  // Get the latest block number
  const latestBlock = await web3.eth.getBlockNumber();
  console.log("Latest block:", latestBlock);

  try {
    const wallet = getLocalWallet();
    // Get events from the last 1000 blocks only
    const pastEvents = await my_contract.getPastEvents('GameResult', {
      fromBlock: latestBlock - 1000,
      toBlock: 'latest'
    });

    // Sort events by block number (newest first) and take the last 10
    const sortedEvents = pastEvents
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, 10);

    // We no longer need to display events in the removed event_log element
    // Instead, just use the events for the personal games list
    
    // Filter for user's games
    if (wallet) {
      const personalGamesList = document.getElementById("personal-games-list");
      personalGamesList.innerHTML = ""; // Clear the list
      
      // Get games that match the user's address
      const userGames = sortedEvents.filter(event => 
        event.returnValues.player && 
        event.returnValues.player.toLowerCase() === wallet.address.toLowerCase()
      );
      
      if (userGames.length === 0) {
        personalGamesList.innerHTML = "<li>No games yet</li>";
      } else {
        userGames.forEach(event => {
          const playerCard = getCardDisplay(parseInt(event.returnValues.playerCard));
          const houseCard = getCardDisplay(parseInt(event.returnValues.houseCard));
          const isWin = event.returnValues.winner.toLowerCase() === wallet.address.toLowerCase();
          
          addGameToPersonalList(playerCard, houseCard, isWin);
        });
      }
    }

    // Subscribe to new events
    my_contract.events.GameResult({}, function(error, event) {
      if (error) {
        console.error("Error in event subscription:", error);
        return;
      }
      
      // We don't need to update the event_log anymore
      // Only update the personal games list if it's the user's game
      const wallet = getLocalWallet();
      if (wallet && 
          event.returnValues.player && 
          event.returnValues.player.toLowerCase() === wallet.address.toLowerCase()) {
        
        const playerCardDisplay = getCardDisplay(parseInt(event.returnValues.playerCard));
        const houseCardDisplay = getCardDisplay(parseInt(event.returnValues.houseCard));
        const isWin = event.returnValues.winner.toLowerCase() === wallet.address.toLowerCase();
        
        // Remove "No games yet" message if present
        const noGamesElement = document.querySelector("#personal-games-list li");
        if (noGamesElement && noGamesElement.textContent === "No games yet") {
          noGamesElement.remove();
        }
        
        addGameToPersonalList(playerCardDisplay, houseCardDisplay, isWin);
      }
    });

    // Similar handling for GameForfeited events
    my_contract.events.GameForfeited({}, function(error, event) {
      if (error) {
        console.error("Error in event subscription:", error);
        return;
      }
      
      const wallet = getLocalWallet();
      if (wallet && 
          event.returnValues.player && 
          event.returnValues.player.toLowerCase() === wallet.address.toLowerCase()) {
        
        const gamesList = document.getElementById("personal-games-list");
        const listItem = document.createElement("li");
        listItem.style.marginBottom = "8px"; // Add margin for better spacing
        listItem.innerHTML = `<span style="color: #dc3545;">• Game forfeited</span>`;
        
        if (gamesList.firstChild) {
          gamesList.insertBefore(listItem, gamesList.firstChild);
        } else {
          gamesList.appendChild(listItem);
        }
      }
    });
  } catch (error) {
    console.error("Error fetching past events:", error);
    const personalGamesList = document.getElementById("personal-games-list");
    if (personalGamesList) {
      personalGamesList.innerHTML = "<li>Error loading games</li>";
    } else {
      console.error("Cannot find personal-games-list element");
    }
  }

  // Get and display game state
  updateGameState();

  // Check if stored secret is still valid
  const secretData = getStoredSecret();
  if (secretData) {
    try {
      const wallet = getLocalWallet();
      if (wallet) {
        const gameState = await my_contract.methods.getGameState(wallet.address).call();
        const commitHash = web3.utils.soliditySha3(secretData.secret);
        const isSecretValid = 
          gameState.gameState === "1"; // Committed state
      }
    } catch (error) {
      console.error("Error checking secret validity:", error);
    }
  }
  
  updateGameState();

  // Start the game loop
  startGameLoop();
}

function generateRandomBytes32() {
    return web3.utils.randomHex(32);
}

function storeSecret(secret) {
    console.log("Storing secret:", secret);
    localStorage.setItem('playerSecret', JSON.stringify({
        secret: secret,
        timestamp: Date.now()
    }));
    // Add a small delay to ensure localStorage is updated
    setTimeout(() => {
        console.log("Updating commitment info after storing secret");
    }, 100);
}

function getStoredSecret() {
    const secretData = localStorage.getItem('playerSecret');
    return secretData ? JSON.parse(secretData) : null;
}

function clearStoredSecret() {
    localStorage.removeItem('playerSecret');
}

// Function to get card display value (J, Q, K, A or number)
function getCardDisplay(cardValue) {
    if (cardValue === 1) return "A";
    if (cardValue === 11) return "J";
    if (cardValue === 12) return "Q";
    if (cardValue === 13) return "K";
    return cardValue.toString();
}

// Function to update the card display
function updateCardDisplay(playerCard, houseCard) {
    document.getElementById("player-card").textContent = getCardDisplay(playerCard);
    document.getElementById("house-card").textContent = getCardDisplay(houseCard);
    
    // Determine and display the winner
    if (playerCard > houseCard) {
        document.getElementById("game-status").textContent = "You won!";
        document.getElementById("game-status").style.color = "#28a745"; // Green
    } else {
        document.getElementById("game-status").textContent = "House wins";
        document.getElementById("game-status").style.color = "#dc3545"; // Red
    }
}

// Function to reset card display
function resetCardDisplay() {
    document.getElementById("player-card").textContent = "0";
    document.getElementById("house-card").textContent = "0";
    document.getElementById("game-status").textContent = "";
}

// Update the game loop function
async function gameLoop() {
    const wallet = getLocalWallet();
    if (!wallet) {
        console.log("No wallet found, skipping game loop");
        return;
    }

    try {
        const gameState = await checkGameState();
        console.log("Game state:", gameState);
        if (!gameState) return;

        const secretData = getStoredSecret();
        if(secretData) {
            console.log("Secret:",{secret: secretData.secret, commitment: web3.utils.soliditySha3(secretData.secret)})
        } else {
            console.log("No secret data found")
        }

        if(wallet) {
          const balance = await web3.eth.getBalance(wallet.address);
          const ethBalance = web3.utils.fromWei(balance, 'ether');
          console.log("Wallet:",{address: wallet.address, privateKey: wallet.privateKey, balance: ethBalance})
        } else {
          console.log("No wallet found")
        }
        
        // If game is in HashPosted state and we have a secret, calculate and reveal
        if (gameState.gameState === "2" && // HashPosted
            secretData) {
            
            // Calculate cards locally
            const result = calculateCards(secretData.secret, gameState.houseHash);
            
            // Update the card display with results
            updateCardDisplay(result.playerCard, result.houseCard);
            
            console.log("Conditions met for reveal, attempting...");
            await performReveal(wallet, secretData.secret);
        }
    } catch (error) {
        console.error("Error in game loop:", error);
    }
}

// Update the commit function to show "Please wait"
async function commit() {
    const wallet = getLocalWallet();
    if (!wallet) {
        alert("No local wallet found!");
        return;
    }

    try {
        // Check if player is already committed
        const gameState = await my_contract.methods.getGameState(wallet.address).call();
        console.log("Game state:", gameState);
        if (gameState.gameState !== "0") { // NotStarted
            alert("You have already committed to this game!");
            return;
        }

        // Reset card display and show waiting status
        resetCardDisplay();
        document.getElementById("game-status").textContent = "Please wait...";

        // Generate random secret
        const secret = generateRandomBytes32();
        storeSecret(secret);
        const commitHash = web3.utils.soliditySha3(secret);
        
        const stakeAmount = await my_contract.methods.STAKE_AMOUNT().call();
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

        console.log("Commit Transaction Receipt:", {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });
        
        updateGameState();
    } catch (error) {
        console.error("Error in commit:", error);
        document.getElementById("game-status").textContent = "";
    }
}

// Update checkGameState function
async function checkGameState() {
    try {
        const wallet = getLocalWallet();
        if (!wallet) return null;

        const gameState = await my_contract.methods.getGameState(wallet.address).call();
        return {
            gameState: gameState.gameState,
            playerCommit: gameState.playerCommit,
            houseHash: gameState.houseHash
        };
    } catch (error) {
        console.error("Error checking game state:", error);
        return null;
    }
}

// Add this function to calculate cards locally
function calculateCards(secret, houseHash) {
    // Convert to BigInt for proper handling of large numbers
    const secretBig = BigInt(secret);
    const houseHashBig = BigInt(houseHash);
    
    // XOR the secret and house hash
    const xorResult = secretBig ^ houseHashBig;
    
    // Extract two card values (1-13) from the XOR result
    // Player card from upper 128 bits
    const playerCard = Number((xorResult >> 128n) % 13n) + 1;
    // House card from lower 128 bits
    const houseCard = Number((xorResult & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn) % 13n) + 1;
    
    // Determine winner
    let winner;
    if (playerCard > houseCard) {
        winner = 'Player';
    } else {
        winner = 'House';
    }
    
    return { playerCard, houseCard, winner };
}

// Function to get card name
function getCardName(cardValue) {
    if (cardValue === 1) return "Ace";
    if (cardValue === 11) return "Jack";
    if (cardValue === 12) return "Queen";
    if (cardValue === 13) return "King";
    return cardValue.toString();
}

// Also update updateGameState to show card calculation when hash is posted
async function updateGameState() {
  const wallet = getLocalWallet();
  if (!wallet) return;

  try {
    const gameState = await my_contract.methods.getGameState(wallet.address).call();
    const stakeAmount = await my_contract.methods.STAKE_AMOUNT().call();
    
    const stateNames = ["Not Started", "Committed", "Hash Posted"];
    const currentState = stateNames[parseInt(gameState.gameState)];
    
    let cardInfo = "";
    
    // If hash is posted and we have a secret, calculate cards and update display
    if (gameState.gameState === "2" && gameState.houseHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const secretData = getStoredSecret();
        if (secretData) {
            const result = calculateCards(secretData.secret, gameState.houseHash);
            // Update the card display
            updateCardDisplay(result.playerCard, result.houseCard);
            cardInfo = `\nPredicted Result: Player: ${result.playerCard} (${getCardName(result.playerCard)}), House: ${result.houseCard} (${getCardName(result.houseCard)}), Winner: ${result.winner}`;
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
    // Then run every 2 seconds
    setInterval(gameLoop, 2000);
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

async function checkLocalWalletBalance() {
  const wallet = getLocalWallet();
  if (wallet) {
    const balance = await web3.eth.getBalance(wallet.address);
    const ethBalance = web3.utils.fromWei(balance, 'ether');
    
    // Update the top-right balance display
    document.getElementById("balance-display").textContent = `Balance: ${parseFloat(ethBalance).toFixed(4)} ETH`;
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
        
        console.log("Forfeit Transaction Receipt:", {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });
        updateGameState();
    } catch (error) {
        console.error("Error in forfeit:", error);
    }
}

// Add the perform reveal function
async function performReveal(wallet, secret) {
    try {
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

        const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log("Reveal Transaction Receipt:", {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });
        
        if (receipt.status) {
            console.log("Reveal successful, clearing secret");
            clearStoredSecret();
          } else {
            console.log("Reveal failed");
            console.log(receipt);
        }
        
        updateGameState();
    } catch (error) {
        console.error("Error in reveal:", error);
    }
}

// Add the withdraw function with ethLeftForGas
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

        // Amount to leave in the wallet for future gas fees (in wei)
        const ethLeftForGas = web3.utils.toWei("0.000000001", "ether"); // 0.005 ETH for future transactions
        
        if (BigInt(balance) <= BigInt(ethLeftForGas)) {
            alert("Balance too low! Leaving funds for gas fees.");
            return;
        }

        const destinationAddress = prompt("Enter the wallet address to withdraw funds to:");
        
        // Validate the address
        if (!destinationAddress || !web3.utils.isAddress(destinationAddress)) {
            alert("Invalid Ethereum address!");
            return;
        }

        // Calculate gas cost for the transaction
        const gasPrice = await web3.eth.getGasPrice();
        const gasLimit = 21000; // Standard ETH transfer gas
        const gasCost = BigInt(gasPrice) * BigInt(gasLimit);
        
        // Calculate amount to send (balance - gas cost - ethLeftForGas)
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
            // Update balance display
            checkLocalWalletBalance();
        } else {
            alert("Withdrawal failed!");
            document.getElementById("game-status").textContent = "";
        }
    } catch (error) {
        console.error("Error withdrawing funds:", error);
        alert("Error withdrawing funds: " + error.message);
        document.getElementById("game-status").textContent = "";
    }
}

// Add this function to manage the personal games list
function addGameToPersonalList(playerCard, houseCard, isWin) {
  const gamesList = document.getElementById("personal-games-list");
  const listItem = document.createElement("li");
  listItem.style.marginBottom = "8px"; // Increased space between items
  
  if (isWin) {
    listItem.innerHTML = `<span style="color: #28a745;">• You won [${playerCard}-${houseCard}]</span>`;
  } else {
    listItem.innerHTML = `<span style="color: #dc3545;">• House wins [${playerCard}-${houseCard}]</span>`;
  }
  
  // Add to the top of the list
  if (gamesList.firstChild) {
    gamesList.insertBefore(listItem, gamesList.firstChild);
  } else {
    gamesList.appendChild(listItem);
  }
}