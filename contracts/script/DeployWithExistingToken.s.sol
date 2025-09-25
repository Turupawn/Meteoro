// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GachaToken} from "../src/GachaToken.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract DeployWithExistingTokenScript is Script {
    TwoPartyWarGame public game;
    GachaToken public gachaToken;
 
    function setUp() public {}
    
    // Alternative run function that accepts address as parameter
    function run(address gachaTokenAddress) public {
        require(gachaTokenAddress != address(0), "GachaToken address cannot be zero");
        
        vm.startBroadcast();

        // Use existing GachaToken
        gachaToken = GachaToken(gachaTokenAddress);
        
        // Deploy new TwoPartyWarGame with existing token
        game = new TwoPartyWarGame(msg.sender, address(gachaToken));

        // Set up bet amounts
        uint[] memory betAmounts = new uint[](3);
        betAmounts[0] = 0.000001 ether;
        betAmounts[1] = 0.000002 ether;
        betAmounts[2] = 0.000003 ether;
        game.setBetAmounts(betAmounts);
        
        // Set the game contract as a minter for the token
        gachaToken.setMinter(address(game), true);

        vm.stopBroadcast();

        console.log("Using existing GachaToken at:", address(gachaToken));
        console.log("TwoPartyWarGame deployed at:", address(game));
    }
}
