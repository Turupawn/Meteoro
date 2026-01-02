// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GachaToken} from "../src/GachaToken.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract DeployWithExistingTokenScript is Script {
    TwoPartyWarGame public game;
    GachaToken public gachaToken;

    // Rise VRF Coordinator address
    address constant VRF_COORDINATOR = 0x9d57aB4517ba97349551C876a01a7580B1338909;
    
    // Initial liquidity for betting payouts
    uint256 constant INITIAL_LIQUIDITY = 0.05 ether;

    function setUp() public {}
    
    function run(address gachaTokenAddress) public {
        require(gachaTokenAddress != address(0), "GachaToken address cannot be zero");
        
        vm.startBroadcast();

        gachaToken = GachaToken(gachaTokenAddress);
        
        game = new TwoPartyWarGame(VRF_COORDINATOR, address(gachaToken));

        uint[] memory betAmounts = new uint[](3);
        betAmounts[0] = 0.001 ether;
        betAmounts[1] = 0.005 ether;
        betAmounts[2] = 0.01 ether;
        game.setBetAmounts(betAmounts);

        game.setBetAmountMultiplier(0.001 ether, 1);
        game.setBetAmountMultiplier(0.005 ether, 5);
        game.setBetAmountMultiplier(0.01 ether, 10);

        gachaToken.setMinter(address(game), true);

        // Send initial liquidity to the contract for bet payouts
        (bool sent,) = address(game).call{value: INITIAL_LIQUIDITY}("");
        require(sent, "Failed to send initial liquidity");

        vm.stopBroadcast();

        console.log("Using existing GachaToken at:", address(gachaToken));
        console.log("TwoPartyWarGame deployed at:", address(game));
        console.log("VRF Coordinator:", VRF_COORDINATOR);
        console.log("Initial liquidity sent:", INITIAL_LIQUIDITY);
    }
}
