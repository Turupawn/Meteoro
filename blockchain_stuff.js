const NETWORK_ID = 6342

const MY_CONTRACT_ADDRESS = "0x0eaF1D6dC09bCBD260d4b23A7De52002bd8a4230"
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
      logElement.innerHTML += `<br>[${timestamp}] Game Result: Winner: ${event.returnValues.winner}, Result: ${event.returnValues.result}`;
    });

    // Subscribe to new events
    my_contract.events.GameResult({}, function(error, event) {
      if (error) {
        console.error("Error in event subscription:", error);
        return;
      }
      const logElement = document.getElementById("event_log");
      const timestamp = new Date().toLocaleTimeString();
      // Add new event at the top
      logElement.innerHTML = `<br>[${timestamp}] Game Result: Winner: ${event.returnValues.winner}, Result: ${event.returnValues.result}` + logElement.innerHTML;
    });

    // In onContractInitCallback, add this to the event subscriptions
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
          gameState.playerState === "1"; // Just check if player is committed
        
        // Comment out automatic clearing
        // if (!isSecretValid) {
        //     clearStoredSecret();
        // }
      }
    } catch (error) {
      console.error("Error checking secret validity:", error);
      // Comment out automatic clearing
      // clearStoredSecret();
    }
  }

  updateCommitmentInfo();
  updateGameState();

  // Start the game loop
  startGameLoop();
}

async function updateGameState() {
  const wallet = getLocalWallet();
  if (!wallet) return;

  try {
    const gameState = await my_contract.methods.getGameState(wallet.address).call();
    const stakeAmount = await my_contract.methods.STAKE_AMOUNT().call();
    
    const stateText = `
      Your State: ${gameState.playerState === "0" ? "Not Started" : 
                   gameState.playerState === "1" ? "Committed" : "Revealed"}
      Your Stake: ${web3.utils.fromWei(gameState.playerStake, 'ether')} ETH
      House Status: ${gameState.housePosted ? "Hash Posted" : "Not Posted"}
      Required Stake: ${web3.utils.fromWei(stakeAmount, 'ether')} ETH
      ${gameState.winner !== "0x0000000000000000000000000000000000000000" ? 
        `Game Result: ${gameState.winner === wallet.address ? "You Won!" : "House Won!"}` : ''}
    `;
    
    document.getElementById("game_state").textContent = stateText;
  } catch (error) {
    console.error("Error updating game state:", error);
  }
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
        updateCommitmentInfo();
    }, 100);
}

function updateCommitmentInfo() {
    console.log("Updating commitment info");
    const secretData = getStoredSecret();
    console.log("Retrieved secret data:", secretData);
    const commitmentElement = document.getElementById("commitment_info");
    
    if (secretData) {
        const commitHash = web3.utils.soliditySha3(secretData.secret);
        console.log("Generated commit hash:", commitHash);
        commitmentElement.innerHTML = `
            Secret: ${secretData.secret}<br>
            Commitment Hash: ${commitHash}
        `;
    } else {
        console.log("No secret data found");
        commitmentElement.textContent = "No active commitment";
    }
}

function getStoredSecret() {
    const secretData = localStorage.getItem('playerSecret');
    console.log("Raw secret data from localStorage:", secretData);
    return secretData ? JSON.parse(secretData) : null;
}

function clearStoredSecret() {
    localStorage.removeItem('playerSecret');
    updateCommitmentInfo();
}

async function commit() {
    const wallet = getLocalWallet();
    if (!wallet) {
        alert("No local wallet found!");
        return;
    }

    try {
        // Check if player is already committed
        const gameState = await my_contract.methods.getGameState(wallet.address).call();
        if (gameState.playerState !== "0") { // NotStarted
            alert("You have already committed to this game!");
            return;
        }

        // Generate random secret
        const secret = generateRandomBytes32();
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

        storeSecret(secret);
        
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
    }
}

// Update checkGameState function
async function checkGameState() {
    try {
        const wallet = getLocalWallet();
        if (!wallet) return null;

        const gameState = await my_contract.methods.getGameState(wallet.address).call();
        return {
            playerState: gameState.playerState,
            housePosted: gameState.housePosted,
            playerStake: gameState.playerStake,
            houseStake: gameState.houseStake,
            winner: gameState.winner
        };
    } catch (error) {
        console.error("Error checking game state:", error);
        return null;
    }
}

// Add game loop function
async function gameLoop() {
    const wallet = getLocalWallet();
    if (!wallet) {
        console.log("No wallet found, skipping game loop");
        return;
    }

    try {
        const gameState = await checkGameState();
        if (!gameState) return;

        const secretData = getStoredSecret();
        
        // If player is committed and has a secret, and house has posted hash, reveal
        if (gameState.playerState === "1" && // Committed
            gameState.housePosted && 
            secretData) {
            console.log("Conditions met for reveal, attempting...");
            await performReveal(wallet, secretData.secret);
        }
    } catch (error) {
        console.error("Error in game loop:", error);
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
    document.getElementById("local_wallet_address").textContent = 
      `Local Wallet Address: ${wallet.address}`;
    document.getElementById("local_wallet_private_key").textContent = 
      `Local Wallet Private Key: ${wallet.privateKey}`;
    document.getElementById("local_wallet_balance").textContent = 
      `Local Wallet Balance: ${ethBalance} ETH`;
  }
}

async function depositEth(amount) {
  if (!accounts || accounts.length === 0) {
    alert("Please connect MetaMask first!");
    return;
  }

  const wallet = getLocalWallet();
  if (!wallet) {
    alert("No local wallet found!");
    return;
  }

  const amountWei = web3.utils.toWei(amount.toString(), 'ether');
  
  try {
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: amountWei
    });
    alert("Deposit successful!");
    checkLocalWalletBalance();
  } catch (error) {
    console.error("Deposit failed:", error);
    alert("Deposit failed!");
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