// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
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
        gachaToken.setMinter(address(game), true);

        vm.stopBroadcast();

        console.log("GachaToken deployed at:", address(gachaToken));
        console.log("TwoPartyWarGame deployed at:", address(game));
    }
}
