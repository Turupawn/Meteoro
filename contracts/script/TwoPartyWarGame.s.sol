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
        betAmounts[0] = 0.001 ether;
        betAmounts[1] = 0.005 ether;
        betAmounts[2] = 0.01 ether;
        game.setBetAmounts(betAmounts);

        game.setBetAmountMultiplier(0.001 ether, 1);
        game.setBetAmountMultiplier(0.005 ether, 5);
        game.setBetAmountMultiplier(0.01 ether, 10);

        gachaToken.setMinter(address(game), true);

        vm.stopBroadcast();

        console.log("GachaToken deployed at:", address(gachaToken));
        console.log("TwoPartyWarGame deployed at:", address(game));
    }
}
