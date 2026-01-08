// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract UpdateBetAmountsScript is Script {
    function setUp() public {}
    
    function run(address gameAddress) public {
        require(gameAddress != address(0), "Game address cannot be zero");
        
        vm.startBroadcast();

        TwoPartyWarGame game = TwoPartyWarGame(payable(gameAddress));
        
        // Hardcoded bet amounts
        uint[] memory betAmounts = new uint[](3);
        betAmounts[0] = 0.001 ether;
        betAmounts[1] = 0.005 ether;
        betAmounts[2] = 0.01 ether;
        
        // Set new bet amounts
        game.setBetAmounts(betAmounts);
        
        // Set hardcoded multipliers
        game.setBetAmountMultiplier(0.001 ether, 1);
        game.setBetAmountMultiplier(0.005 ether, 5);
        game.setBetAmountMultiplier(0.01 ether, 10);

        vm.stopBroadcast();

        console.log("Updated game at:", address(game));
        console.log("New bet amounts: 0.001, 0.005, 0.01 ether");
        console.log("New multipliers: 1, 5, 10");
    }
}
