// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract UpgradeScript is Script {
    function setUp() public {}

    function run(address proxyAddress) public {
        vm.startBroadcast();

        // Deploy new implementation
        TwoPartyWarGame newImplementation = new TwoPartyWarGame();

        // Cast proxy to game interface
        TwoPartyWarGame proxy = TwoPartyWarGame(payable(proxyAddress));

        // Upgrade the proxy to point to new implementation
        // Empty bytes means no initialization call
        proxy.upgradeToAndCall(address(newImplementation), "");

        vm.stopBroadcast();

        console.log("New implementation deployed at:", address(newImplementation));
        console.log("Proxy upgraded at:", proxyAddress);
        console.log("\n=== IMPORTANT ===");
        console.log("Proxy address (unchanged):", proxyAddress);
        console.log("New implementation address:", address(newImplementation));
    }
}

