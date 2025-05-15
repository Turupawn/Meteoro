const NETWORK_ID = 6342

const MY_CONTRACT_ADDRESS = "0x862A40C84E1A092363C3b87d492B8fCee3f9292E"
const MY_CONTRACT_ABI_PATH = "./json_abi/MyContract.json"
var my_contract

var accounts
var web3

function metamaskReloadCallback() {
  window.ethereum.on('accountsChanged', (accounts) => {
    document.getElementById("web3_message").textContent="Se cambió el account, refrescando...";
    window.location.reload()
  })
  window.ethereum.on('networkChanged', (accounts) => {
    document.getElementById("web3_message").textContent="Se el network, refrescando...";
    window.location.reload()
  })
}

const getWeb3 = async () => {
  return new Promise((resolve, reject) => {
    if(document.readyState=="complete")
    {
      if (window.ethereum) {
        const web3 = new Web3(window.ethereum)
        window.location.reload()
        resolve(web3)
      } else {
        reject("must install MetaMask")
        document.getElementById("web3_message").textContent="Error: Porfavor conéctate a Metamask";
      }
    }else
    {
      window.addEventListener("load", async () => {
        if (window.ethereum) {
          const web3 = new Web3(window.ethereum)
          resolve(web3)
        } else {
          reject("must install MetaMask")
          document.getElementById("web3_message").textContent="Error: Please install Metamask";
        }
      });
    }
  });
};

const getContract = async (web3, address, abi_path) => {
  const response = await fetch(abi_path);
  const data = await response.json();
  
  const netId = await web3.eth.net.getId();
  contract = new web3.eth.Contract(
    data,
    address
    );
  return contract
}

async function loadDapp() {
  metamaskReloadCallback()
  document.getElementById("web3_message").textContent="Please connect to Metamask"
  var awaitWeb3 = async function () {
    web3 = await getWeb3()
    web3.eth.net.getId((err, netId) => {
      console.log("netId: " + netId)
      if (netId == NETWORK_ID) {
        var awaitContract = async function () {
          my_contract = await getContract(web3, MY_CONTRACT_ADDRESS, MY_CONTRACT_ABI_PATH)
          document.getElementById("web3_message").textContent="You are connected to Metamask"
          
          // Check for local wallet
          let wallet = getLocalWallet();
          if (!wallet) {
            wallet = generateWallet();
            checkLocalWalletBalance();
          } else {
            checkLocalWalletBalance();
          }
          
          onContractInitCallback()
          web3.eth.getAccounts(function(err, _accounts){
            accounts = _accounts
            if (err != null) {
              console.error("An error occurred: "+err)
            } else if (accounts.length > 0) {
              onWalletConnectedCallback()
              document.getElementById("account_address").style.display = "block"
            } else {
              document.getElementById("connect_button").style.display = "block"
            }
          });
        };
        awaitContract();
      } else {
        document.getElementById("web3_message").textContent="Please connect to Holesky";
      }
    });
  };
  awaitWeb3();
}

async function connectWallet() {
  await window.ethereum.request({ method: "eth_requestAccounts" })
  accounts = await web3.eth.getAccounts()
  onWalletConnectedCallback()
}

loadDapp()

const onContractInitCallback = async () => {
  // Get the latest block number
  const latestBlock = await web3.eth.getBlockNumber();
  console.log("Latest block:", latestBlock);

  try {
    // Get events from the last 1000 blocks only
    const pastEvents = await my_contract.getPastEvents('GameResult', {
      fromBlock: latestBlock - 1000,
      toBlock: 'latest'
    });

    // Sort events by block number (newest first) and take the last 10
    const sortedEvents = pastEvents
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, 10);

    // Display past events
    const logElement = document.getElementById("event_log");
    logElement.innerHTML = "<h3>Recent Game Results:</h3>";
    
    sortedEvents.forEach(event => {
      const timestamp = new Date().toLocaleTimeString();
      const playerCard = event.returnValues.playerCard;
      const houseCard = event.returnValues.houseCard;
      logElement.innerHTML += `<br>[${timestamp}] War Game: Player: ${playerCard} (${getCardName(playerCard)}), House: ${houseCard} (${getCardName(houseCard)}), Winner: ${event.returnValues.winner}`;
    });

    // Subscribe to new events
    my_contract.events.GameResult({}, function(error, event) {
      if (error) {
        console.error("Error in event subscription:", error);
        return;
      }
      const logElement = document.getElementById("event_log");
      const timestamp = new Date().toLocaleTimeString();
      const playerCard = event.returnValues.playerCard;
      const houseCard = event.returnValues.houseCard;
      // Add new event at the top
      logElement.innerHTML = `<br>[${timestamp}] War Game: Player: ${playerCard} (${getCardName(playerCard)}), House: ${houseCard} (${getCardName(houseCard)}), Winner: ${event.returnValues.winner}` + logElement.innerHTML;
    });

    // Subscribe to GameForfeited events
    my_contract.events.GameForfeited({}, function(error, event) {
        if (error) {
            console.error("Error in event subscription:", error);
            return;
        }
        const logElement = document.getElementById("event_log");
        const timestamp = new Date().toLocaleTimeString();
        logElement.innerHTML = `<br>[${timestamp}] Game Forfeited: Player ${event.returnValues.player} forfeited to House ${event.returnValues.house}` + logElement.innerHTML;
    });
  } catch (error) {
    console.error("Error fetching past events:", error);
    const logElement = document.getElementById("event_log");
    logElement.innerHTML = "<h3>Error loading past events. New events will still be shown.</h3>";
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
        
        if (receipt.status) {
            document.getElementById("web3_message").textContent = "Commit successful! Waiting for house to post hash...";
        }
        
        console.log("Commit Transaction Receipt:", {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });
        
        updateGameState();
    } catch (error) {
        console.error("Error in commit:", error);
        document.getElementById("web3_message").textContent = "Error in commit!";
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
        
        document.getElementById("web3_message").textContent = "Game forfeited!";
        updateGameState();
    } catch (error) {
        console.error("Error in forfeit:", error);
        document.getElementById("web3_message").textContent = "Error in forfeit!";
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
            document.getElementById("web3_message").textContent = "Reveal successful!";
            // Clear the secret after successful reveal
            clearStoredSecret();
        } else {
            document.getElementById("web3_message").textContent = "Reveal failed!";
        }
        
        updateGameState();
    } catch (error) {
        console.error("Error in reveal:", error);
        document.getElementById("web3_message").textContent = "Error in reveal!";
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