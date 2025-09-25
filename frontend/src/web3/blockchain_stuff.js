import Web3 from 'web3';
import { printLog } from '../utils/utils.js';

const MY_CONTRACT_ADDRESS = import.meta.env.CONTRACT_ADDRESS;
const MY_CONTRACT_ABI_PATH = "/json_abi/MyContract.json";
const GAS_LIMIT = 300000;

let web3;
let my_contract;
let globalSelectedBetAmount = null;
let globalBetAmountsArray = null;
let globalGasPrice = null;
let globalNonce = null;
let globalETHBalance = null;
let globalGachaTokenBalance = null;
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
        throw error;
      }
    };
    return awaitContract();
  };
  return awaitWeb3();
  
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
            recentHistory: gameStateTemp.recentHistory
        };
        return gameState;
    } catch (error) {
        console.error("Error checking game state:", error);
        return null;
    }
}

export async function commit(commitHash) {
    const wallet = getLocalWallet();
    if (!wallet) {
        throw new Error("No local wallet found!");
    }

    if (!globalSelectedBetAmount) {
        await initializeBetAmount();
    }
    let data;
    try {
        data = my_contract.methods.commit(commitHash).encodeABI();
    } catch (error) {
        console.error("Error encoding commit ABI:", error);
        throw error;
    }
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
        value: globalSelectedBetAmount,
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
    
    return receipt;
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
            nonce: await web3.eth.getTransactionCount(wallet.address, 'latest')
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
            nonce: await web3.eth.getTransactionCount(wallet.address, 'latest')
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
            nonce: await web3.eth.getTransactionCount(wallet.address, 'latest')
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
        globalGasPrice = await web3.eth.getGasPrice();
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
    return globalGasPrice*2n;
}

export async function initializeNonce() {
    try {
        const wallet = getLocalWallet();
        if (!wallet) return;
        
        const startTime = Date.now();
        globalNonce = await web3.eth.getTransactionCount(wallet.address, 'latest');
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

export async function initializeBetAmount() {
    try {
        // Get the bet amounts array in a single call
        const betAmountsArray = await my_contract.methods.getBetAmountsArray().call();
        globalBetAmountsArray = betAmountsArray;
        printLog(['debug'], "Bet amounts array from contract:", betAmountsArray);

        console.log("betAmountsArray", betAmountsArray);
        
        if (betAmountsArray.length === 0) {
            throw new Error("No bet amounts configured in contract");
        }
        
        const storedBetAmount = localStorage.getItem('selectedBetAmount');

        printLog(['debug'], "storedBetAmount", storedBetAmount);
        printLog(['debug'], "betAmountsArray", betAmountsArray);
        
        if (storedBetAmount) {
            const storedBetAmountBigInt = BigInt(storedBetAmount);
            const isValidBetAmount = betAmountsArray.includes(storedBetAmountBigInt);
            if (isValidBetAmount) {
                setSelectedBetAmount(storedBetAmountBigInt);
                printLog(['debug'], "Using stored bet amount:", globalSelectedBetAmount);
            } else {
                setSelectedBetAmount(betAmountsArray[0]);
                printLog(['debug'], "Stored bet amount no longer valid, selected first:", globalSelectedBetAmount);
            }
        } else {
            setSelectedBetAmount(betAmountsArray[0]);
            printLog(['debug'], "No stored bet amount, selected first:", globalSelectedBetAmount);
        }
        printLog(['debug'], "Bet amount initialized:", globalSelectedBetAmount);
    } catch (error) {
        printLog(['error'], "Error initializing bet amount:", error);
        throw error;
    }
}

export function getBetAmountsArray() {
    return globalBetAmountsArray;
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
    return BigInt(globalSelectedBetAmount) + BigInt(globalSelectedBetAmount);
}

export function getRecommendedPlayableBalance() {
    if (!globalSelectedBetAmount) {
        throw new Error("Bet amount not initialized");
    }
    return BigInt(globalSelectedBetAmount) * 10n;
}

export function getPlayerETHBalance() {
    return globalETHBalance;
}

export function getPlayerGachaTokenBalance() {
    return globalGachaTokenBalance;
}

export { web3, my_contract }; 