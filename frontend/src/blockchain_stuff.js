import Web3 from 'web3';
import { loadPhaser } from './game.js';
import { printLog } from './utils.js';

const NETWORK_ID = 6342;
const MY_CONTRACT_ADDRESS = import.meta.env.CONTRACT_ADDRESS;
const MY_CONTRACT_ABI_PATH = "/json_abi/MyContract.json";
const GAS_LIMIT = 300000;

let web3;
let my_contract;
let globalStakeAmount = null;
let globalGasPrice = null;
let globalNonce = null;
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
        
        const gameStateTemp = await my_contract.methods.getGameState(wallet.address).call({}, 'pending');
        
        const gameState = {
            playerBalance: gameStateTemp.player_balance,
            gameState: gameStateTemp.gameState,
            playerCommit: gameStateTemp.playerCommit,
            houseHash: gameStateTemp.houseHash,
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
    
    // Ensure stake amount is initialized
    if (!globalStakeAmount) {
        await initializeStakeAmount();
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
        value: globalStakeAmount,
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
    
    const gasPrice = await web3.eth.getGasPrice();
    const gasLimit = 21000;
    const gasCost = BigInt(gasPrice) * BigInt(gasLimit);
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
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    return { receipt, amountToSend };
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

export async function initializeStakeAmount() {
    globalStakeAmount = await my_contract.methods.STAKE_AMOUNT().call();
    printLog(['debug'], "Stake amount initialized:", globalStakeAmount);
}

export { web3, my_contract }; 