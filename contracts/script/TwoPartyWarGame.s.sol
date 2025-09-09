// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GachaToken} from "../src/GachaToken.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract TwoPartyWarGameScript is Script {
    GachaToken public gachaToken;
    TwoPartyWarGame public game;
 
    function setUp() public {}
 
    function run() public {
        vm.startBroadcast();

        gachaToken = new GachaToken("GachaToken", "GACHA");
        game = new TwoPartyWarGame(msg.sender, address(gachaToken));

        uint[] memory betAmounts = new uint[](3);
        betAmounts[0] = 0.000004 ether;
        betAmounts[1] = 0.000002 ether;
        betAmounts[2] = 0.000003 ether;
        game.setBetAmounts(betAmounts);
        
        gachaToken.setMinter(address(game), true);

        vm.stopBroadcast();

        console.log("GachaToken deployed at:", address(gachaToken));
        console.log("TwoPartyWarGame deployed at:", address(game));
    }
}
