// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface IOldContract {
    function withdrawFunds(uint256 amount) external;
    function getContractBalance() external view returns (uint256);
    function owner() external view returns (address);
}

contract WithdrawFromOldContractScript is Script {
    function setUp() public {}

    function run(address payable oldContractAddress) public {
        require(oldContractAddress != address(0), "Contract address cannot be zero");
        
        IOldContract oldContract = IOldContract(oldContractAddress);
        
        // Get current balance
        uint256 balance = oldContract.getContractBalance();
        console.log("Old contract address:", oldContractAddress);
        console.log("Current balance:", balance);
        console.log("Owner:", oldContract.owner());
        
        if (balance == 0) {
            console.log("No funds to withdraw");
            return;
        }
        
        vm.startBroadcast();
        
        // Withdraw all funds
        oldContract.withdrawFunds(balance);
        
        vm.stopBroadcast();
        
        console.log("Successfully withdrew:", balance, "wei");
        console.log("That's approximately:", balance / 1e15, "finney (0.001 ETH)");
    }
}

