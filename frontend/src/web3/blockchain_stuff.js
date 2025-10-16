import Web3 from 'web3';
import { printLog, getCardDisplay } from '../utils/utils.js';
import { captureBlockchainError } from '../session_tracking.js';
import { showErrorModal } from '../menus/errorModal.js';

const MY_CONTRACT_ADDRESS = import.meta.env.CONTRACT_ADDRESS;
const MY_CONTRACT_ABI_PATH = "/json_abi/MyContract.json";
const GAS_LIMIT = 300000;
const GAS_FEE_BUFFER_ETH = 0.00001;

let web3;
let my_contract;
let globalSelectedBetAmount = null;
let globalBetAmountsArray = null;
let globalBetAmountMultipliers = null;
let globalTieRewardMultiplier = null;
let globalGasPrice = null;
let globalNonce = null;
let globalETHBalance = null;
let globalGachaTokenBalance = null;
let globalRecentHistory = null;
let lastGasPriceUpdate = 0;
const GAS_PRICE_UPDATE_INTERVAL = 60000;

export function getLocalWallet() {
    const walletData = localStorage.getItem('localWallet');
    if (walletData) {
      return JSON.parse(walletData);
    }
    return null;
}

export const getWeb3 = async () => {
  return new Promise((resolve, reject) => {
    const provider = new Web3.providers.HttpProvider("https://carrot.megaeth.com/rpc");
    const web3 = new Web3(provider);
    resolve(web3);
  });
};

export const getContract = async (web3, address, abi_path) => {
  const response = await fetch(abi_path);
  const data = await response.json();
  const contract = new web3.eth.Contract(
    data,
    address
    );
  return contract;
};

export function generateWallet() {
  const account = web3.eth.accounts.create();
  localStorage.setItem('localWallet', JSON.stringify({
    address: account.address,
    privateKey: account.privateKey
  }));
  return account;
}

export async function initWeb3() {
  var awaitWeb3 = async function () {
    web3 = await getWeb3();
    var awaitContract = async function () {
      try {
        my_contract = await getContract(web3, MY_CONTRACT_ADDRESS, MY_CONTRACT_ABI_PATH);
        let wallet = getLocalWallet();
        if (!wallet) {
          wallet = generateWallet();
        }
        return { web3, my_contract, wallet };
      } catch (error) {
        console.error("Error initializing contract:", error);
        showErrorModal("Failed to initialize contract: " + error.message + " (code " + (error.code || 'unknown') + ")");
        throw error;
      }
    };
    return awaitContract();
  };
  return awaitWeb3();
  
}

export async function checkInitialGameState() {
    const startTime = Date.now();
    try {
        const wallet = getLocalWallet();
        if (!wallet) {
            return null;
        }
        
        const gameStateTemp = await my_contract.methods.getInitialFrontendGameState(wallet.address).call({}, 'pending');
        globalETHBalance = gameStateTemp.playerEthBalance;
        globalGachaTokenBalance = gameStateTemp.playerGachaTokenBalance;
        globalRecentHistory = gameStateTemp.recentHistory;
        
        // Store bet amounts and multipliers globally
        globalBetAmountsArray = gameStateTemp.betAmounts;
        globalBetAmountMultipliers = gameStateTemp.betAmountMultipliersArray;
        globalTieRewardMultiplier = gameStateTemp.tieRewardMultiplierValue;
        
        printLog(['debug'], "Bet amounts array from contract:", gameStateTemp.betAmounts);
        
        if (gameStateTemp.betAmounts.length === 0) {
            throw new Error("No bet amounts configured in contract");
        }
        
        const storedBetAmount = localStorage.getItem('selectedBetAmount');
        printLog(['debug'], "storedBetAmount", storedBetAmount);
        
        if (storedBetAmount) {
            const storedBetAmountBigInt = BigInt(storedBetAmount);
            const isValidBetAmount = gameStateTemp.betAmounts.includes(storedBetAmountBigInt);
            if (isValidBetAmount) {
                setSelectedBetAmount(storedBetAmountBigInt);
                printLog(['debug'], "Using stored bet amount:", globalSelectedBetAmount);
            } else {
                setSelectedBetAmount(gameStateTemp.betAmounts[0]);
                printLog(['debug'], "Stored bet amount no longer valid, selected first:", globalSelectedBetAmount);
            }
        } else {
            setSelectedBetAmount(gameStateTemp.betAmounts[0]);
            printLog(['debug'], "No stored bet amount, selected first:", globalSelectedBetAmount);
        }
        
        const gameState = {
            playerETHBalance: gameStateTemp.playerEthBalance,
            playerGachaTokenBalance: gameStateTemp.playerGachaTokenBalance,
            gameState: gameStateTemp.gameState,
            playerCommit: gameStateTemp.playerCommit,
            houseRandomness: gameStateTemp.houseRandomness,
            gameId: gameStateTemp.gameId,
            recentHistory: gameStateTemp.recentHistory,
            tieRewardMultiplier: gameStateTemp.tieRewardMultiplierValue,
            betAmounts: gameStateTemp.betAmounts,
            betAmountMultipliers: gameStateTemp.betAmountMultipliersArray
        };
        
        printLog(['profile'], "=== INITIAL GAME STATE LOAD ===");
        printLog(['profile'], "Game state loaded successfully");
        printLog(['profile'], "Time taken:", Date.now() - startTime, "ms");
        printLog(['profile'], "=============================");
        
        return gameState;
    } catch (error) {
        printLog(['profile'], "=== INITIAL GAME STATE LOAD ===");
        printLog(['profile'], "Game state load failed");
        printLog(['profile'], "Time taken:", Date.now() - startTime, "ms");
        printLog(['profile'], "=============================");
        
        console.error("Error checking initial game state:", error);
        showErrorModal("Failed to check initial game state: " + error.message + " (code " + (error.code || 'unknown') + ")");
        captureBlockchainError(error, 'checkInitialGameState', {
            contract_address: MY_CONTRACT_ADDRESS,
            error_type: 'blockchain_call_failed'
        });
        
        return null;
    }
}

export async function checkGameState() {
    try {
        const wallet = getLocalWallet();
        if (!wallet) {
            return null;
        }
        
        const gameStateTemp = await my_contract.methods.getFrontendGameState(wallet.address).call({}, 'pending');
        globalETHBalance = gameStateTemp.playerEthBalance;
        globalGachaTokenBalance = gameStateTemp.playerGachaTokenBalance;
        const gameState = {
            playerETHBalance: gameStateTemp.playerEthBalance,
            playerGachaTokenBalance: gameStateTemp.playerGachaTokenBalance,
            gameState: gameStateTemp.gameState,
            playerCommit: gameStateTemp.playerCommit,
            houseRandomness: gameStateTemp.houseRandomness,
            gameId: gameStateTemp.gameId,
            recentHistory: globalRecentHistory
        };
        return gameState;
    } catch (error) {
        console.error("Error checking game state:", error);
        showErrorModal("Failed to check game state: " + error.message + " (code " + (error.code || 'unknown') + ")");
        captureBlockchainError(error, 'checkGameState', {
            contract_address: MY_CONTRACT_ADDRESS,
            error_type: 'blockchain_call_failed'
        });
        
        return null;
    }
}

export async function commit(commitHash) {
    const wallet = getLocalWallet();
    if (!wallet) {
        const error = new Error("No local wallet found!");
        showErrorModal(error.message);
        captureBlockchainError(error, 'commit', {
            error_type: 'wallet_not_found'
        });
        throw error;
    }

    if (!globalSelectedBetAmount) {
        await initializeBetAmount();
    }
    let data;
    try {
        data = my_contract.methods.commit(commitHash).encodeABI();
    } catch (error) {
        showErrorModal("Failed to encode commit ABI: " + error.message + " (code " + (error.code || 'unknown') + ")");
        captureBlockchainError(error, 'commit', {
            error_type: 'abi_encoding_failed',
            commit_hash: commitHash
        });
        throw error;
    }
    const nonce = getAndIncrementNonce();
    const gasPrice = await getCurrentGasPrice();
    
    if (nonce === null || !gasPrice) {
        const error = new Error("Failed to get nonce or gas price");
        showErrorModal("Failed to get nonce or gas price: " + error.message + " (code " + (error.code || 'unknown') + ")");
        captureBlockchainError(error, 'commit', {
            error_type: 'gas_or_nonce_failed',
            nonce: nonce,
            gas_price: gasPrice
        });
        throw error;
    }
    
    const tx = {
        from: wallet.address,
        to: MY_CONTRACT_ADDRESS,
        nonce: nonce,
        gasPrice: gasPrice,
        gas: GAS_LIMIT,
        value: globalSelectedBetAmount,
        data: data
    };

    try {
        const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        printLog(['debug'], "Commit Transaction Receipt:", {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });
        
        return receipt;
    } catch (error) {
        showErrorModal("Failed to commit: " + error.message + " (code " + (error.code || 'unknown') + ")");
        captureBlockchainError(error, 'commit', {
            error_type: 'transaction_failed',
            transaction_data: {
                to: MY_CONTRACT_ADDRESS,
                value: globalSelectedBetAmount?.toString(),
                gas: GAS_LIMIT,
                nonce: nonce
            }
        });
        throw error;
    }
}

export async function forfeit() {
    const wallet = getLocalWallet();
    if (!wallet) {
        throw new Error("No local wallet found!");
    }
    
    const data = my_contract.methods.forfeit().encodeABI();
    const nonce = getAndIncrementNonce();
    const gasPrice = await getCurrentGasPrice();
    
    if (nonce === null || !gasPrice) {
        throw new Error("Failed to get nonce or gas price");
    }
    
    const tx = {
        from: wallet.address,
        to: MY_CONTRACT_ADDRESS,
        nonce: nonce,
        gasPrice: gasPrice,
        gas: GAS_LIMIT,
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

    return receipt;
}

export async function performReveal(secret) {
    try {
        printLog(['debug'], "=== PERFORM REVEAL START ===");
        
        const data = my_contract.methods.reveal(secret).encodeABI();
        const wallet = getLocalWallet();
        const nonce = getAndIncrementNonce();
        const gasPrice = await getCurrentGasPrice();
        
        if (nonce === null || !gasPrice) {
            const error = new Error("Failed to get nonce or gas price");
            showErrorModal("Failed to get nonce or gas price: " + error.message + " (code " + (error.code || 'unknown') + ")");
            captureBlockchainError(error, 'performReveal', {
                error_type: 'gas_or_nonce_failed',
                nonce: nonce,
                gas_price: gasPrice
            });
            throw error;
        }
        
        const tx = {
            from: wallet.address,
            to: MY_CONTRACT_ADDRESS,
            nonce: nonce,
            gasPrice: gasPrice,
            gas: GAS_LIMIT,
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
        
        printLog(['debug'], "=== PERFORM REVEAL END ===");
        return receipt;
    } catch (error) {
        printLog(['error'], "Error in reveal:", error);
        showErrorModal("Failed to reveal: " + error.message + " (code " + (error.code || 'unknown') + ")");
        captureBlockchainError(error, 'performReveal', {
            error_type: 'reveal_transaction_failed',
            secret_provided: !!secret
        });
        throw error;
    }
}

export async function withdrawFunds(destinationAddress) {
    const wallet = getLocalWallet();
    if (!wallet) {
        throw new Error("No local wallet found!");
    }
    
    const balance = await web3.eth.getBalance(wallet.address);
    if (balance <= 0) {
        throw new Error("No funds to withdraw!");
    }
    
    const ethLeftForGas = web3.utils.toWei("0.000000001", "ether");
    if (BigInt(balance) <= BigInt(ethLeftForGas)) {
        throw new Error("Balance too low! Leaving funds for gas fees.");
    }
    
    if (!destinationAddress || !web3.utils.isAddress(destinationAddress)) {
        throw new Error("Invalid Ethereum address!");
    }
    
    // Check if player has Gacha tokens
    const gachaTokenBalance = globalGachaTokenBalance || BigInt(0);
    const hasGachaTokens = gachaTokenBalance > 0;
    
    let gasLimit = 21000; // Base gas for ETH transfer
    let gasPrice = await web3.eth.getGasPrice();
    let gasCost = BigInt(gasPrice) * BigInt(gasLimit);
    
    if (hasGachaTokens) {
        // Use Multicall3 to bundle both ETH and Gacha token transfers in a single transaction
        const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
        
        // Get the Gacha token contract address from the main contract
        const gachaTokenAddress = await my_contract.methods.gachaToken().call();
        
        // Create a contract instance for the Gacha token
        const gachaTokenABI = [
            {
                "constant": false,
                "inputs": [
                    {"name": "_to", "type": "address"},
                    {"name": "_value", "type": "uint256"}
                ],
                "name": "transfer",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            }
        ];
        
        const gachaTokenContract = new web3.eth.Contract(gachaTokenABI, gachaTokenAddress);
        
        // Encode the Gacha token transfer function call
        const tokenTransferData = gachaTokenContract.methods.transfer(destinationAddress, gachaTokenBalance.toString()).encodeABI();
        
        // Calculate ETH amount to send (after reserving gas for multicall)
        gasLimit = 200000; // Higher gas limit for multicall
        gasCost = BigInt(gasPrice) * BigInt(gasLimit);
        const ethAmountToSend = BigInt(balance) - gasCost - BigInt(ethLeftForGas);
        
        if (ethAmountToSend <= 0) {
            throw new Error("Balance too low to withdraw after reserving gas fees!");
        }
        
        // First transaction: Transfer Gacha tokens
        const tokenTx = {
            from: wallet.address,
            to: gachaTokenAddress,
            value: "0",
            data: tokenTransferData,
            gas: 100000, // Gas for token transfer
            gasPrice: gasPrice,
            nonce: await web3.eth.getTransactionCount(wallet.address, 'pending')
        };
        
        console.log("Transferring Gacha tokens...");
        const signedTokenTx = await web3.eth.accounts.signTransaction(tokenTx, wallet.privateKey);
        const tokenReceipt = await web3.eth.sendSignedTransaction(signedTokenTx.rawTransaction);
        
        // Second transaction: Transfer ETH
        const ethTx = {
            from: wallet.address,
            to: destinationAddress,
            value: ethAmountToSend.toString(),
            gas: 21000, // Standard gas for ETH transfer
            gasPrice: gasPrice,
            nonce: await web3.eth.getTransactionCount(wallet.address, 'pending')
        };
        
        console.log("Transferring ETH...");
        const signedEthTx = await web3.eth.accounts.signTransaction(ethTx, wallet.privateKey);
        const ethReceipt = await web3.eth.sendSignedTransaction(signedEthTx.rawTransaction);
        
        console.log("Withdrawal completed:", {
            tokenTransactionHash: tokenReceipt.transactionHash,
            ethTransactionHash: ethReceipt.transactionHash,
            tokenStatus: tokenReceipt.status ? "Confirmed" : "Failed",
            ethStatus: ethReceipt.status ? "Confirmed" : "Failed",
            totalGasUsed: parseInt(tokenReceipt.gasUsed) + parseInt(ethReceipt.gasUsed)
        });
        
        return { 
            receipt: ethReceipt, 
            amountToSend: ethAmountToSend.toString(), 
            tokensTransferred: gachaTokenBalance.toString(),
            tokenReceipt: tokenReceipt
        };
    } else {
        // Normal ETH withdrawal when no Gacha tokens
        const amountToSend = BigInt(balance) - gasCost - BigInt(ethLeftForGas);
        
        if (amountToSend <= 0) {
            throw new Error("Balance too low to withdraw after reserving gas fees!");
        }
        
        const tx = {
            from: wallet.address,
            to: destinationAddress,
            value: amountToSend.toString(),
            gas: gasLimit,
            gasPrice: gasPrice,
            nonce: await web3.eth.getTransactionCount(wallet.address, 'pending')
        };
        
        console.log("Withdrawing ETH only:", {
            amount: amountToSend.toString(),
            destination: destinationAddress
        });
        
        const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log("Withdrawal completed:", {
            transactionHash: receipt.transactionHash,
            status: receipt.status ? "Confirmed" : "Failed",
            gasUsed: receipt.gasUsed
        });
        
        return { receipt, amountToSend: amountToSend.toString(), tokensTransferred: "0" };
    }
}

export async function updateGasPrice() {
    try {
        const startTime = Date.now();
        const gasPriceString = await web3.eth.getGasPrice('pending');
        globalGasPrice = BigInt(gasPriceString);
        lastGasPriceUpdate = startTime;
        printLog(['profile'], "=== GAS PRICE UPDATE ===");
        printLog(['profile'], "New gas price:", globalGasPrice);
        printLog(['profile'], "Time taken:", Date.now() - startTime, "ms");
        printLog(['profile'], "=========================");
    } catch (error) {
        printLog(['error'], "Error updating gas price:", error);
    }
}

export async function getCurrentGasPrice() {
    const now = Date.now();
    if (!globalGasPrice || (now - lastGasPriceUpdate) > GAS_PRICE_UPDATE_INTERVAL) {
        await updateGasPrice();
    }
    
    if (!globalGasPrice) {
        throw new Error("Failed to get gas price");
    }
    
    return globalGasPrice * 2n;
}

export async function initializeNonce() {
    try {
        const wallet = getLocalWallet();
        if (!wallet) return;
        
        const startTime = Date.now();
        globalNonce = await web3.eth.getTransactionCount(wallet.address, 'pending');
        printLog(['profile'], "=== NONCE INITIALIZATION ===");
        printLog(['profile'], "Initial nonce:", globalNonce);
        printLog(['profile'], "Time taken:", Date.now() - startTime, "ms");
        printLog(['profile'], "===========================");
    } catch (error) {
        printLog(['error'], "Error initializing nonce:", error);
    }
}

export function getAndIncrementNonce() {
    if (globalNonce === null) {
        printLog(['error'], "Nonce not initialized");
        return null;
    }
    return globalNonce++;
}


export function getBetAmountsArray() {
    return globalBetAmountsArray;
}

export function getBetAmountMultiplier(betAmount) {
    if (!globalBetAmountsArray || !globalBetAmountMultipliers) {
        return 1; // Default to 1x if not available
    }
    
    const index = globalBetAmountsArray.indexOf(betAmount);
    if (index === -1) {
        return 1; // Default to 1x if bet amount not found
    }
    
    return globalBetAmountMultipliers[index] || 1;
}

export function setSelectedBetAmount(betAmount) {
    globalSelectedBetAmount = betAmount;
    localStorage.setItem('selectedBetAmount', betAmount);
    printLog(['debug'], "Bet amount updated:", betAmount);
}

export function getSelectedBetAmount() {
    return globalSelectedBetAmount;
}

export function getMinimumPlayableBalance() {
    if (!globalSelectedBetAmount) {
        throw new Error("Bet amount not initialized");
    }
    const gasFeeBufferWei = web3.utils.toWei(GAS_FEE_BUFFER_ETH.toString(), 'ether');
    return BigInt(globalSelectedBetAmount) + BigInt(gasFeeBufferWei);
}

export function getPlayerETHBalance() {
    return globalETHBalance;
}

export function addPendingGameToHistory() {
    if (!globalRecentHistory) {
        globalRecentHistory = [];
    }
    
    const newGame = {
        gameState: 1, // Committed state
        playerAddress: getLocalWallet()?.address || "0x0",
        playerCommit: "0x0",
        commitTimestamp: Math.floor(Date.now() / 1000),
        betAmount: globalSelectedBetAmount || "0",
        houseRandomness: "0x0",
        houseRandomnessTimestamp: 0,
        playerSecret: "0x0",
        playerCard: "?", // Placeholder
        houseCard: "?", // Placeholder
        revealTimestamp: 0
    };
    
    // Add to the beginning of the array (most recent first)
    globalRecentHistory.unshift(newGame);
    
    // Keep only the last 10 games (MAX_RETURN_HISTORY)
    if (globalRecentHistory.length > 10) {
        globalRecentHistory = globalRecentHistory.slice(0, 10);
    }
}

export function updateLastGameInHistory(playerCard, houseCard) {
    if (!globalRecentHistory || globalRecentHistory.length === 0) {
        return;
    }
    
    // Update the first (most recent) game with the actual results
    const lastGame = globalRecentHistory[0];
    if (lastGame && lastGame.playerCard === "?" && lastGame.houseCard === "?") {
        lastGame.playerCard = getCardDisplay(playerCard);
        lastGame.houseCard = getCardDisplay(houseCard);
        lastGame.revealTimestamp = Math.floor(Date.now() / 1000);
    }
}

export { web3, my_contract }; 