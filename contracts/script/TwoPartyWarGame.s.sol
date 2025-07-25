// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract TwoPartyWarGameScript is Script {
    TwoPartyWarGame public game;
 
    function setUp() public {}
 
    function run() public {
        vm.startBroadcast();
 
        game = new TwoPartyWarGame(msg.sender);
 
        vm.stopBroadcast();
    }
}
