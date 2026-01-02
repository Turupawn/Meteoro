// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GachaToken} from "../src/GachaToken.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract DeployUpgradableScript is Script {
    GachaToken public gachaToken;
    TwoPartyWarGame public implementation;
    ERC1967Proxy public proxy;
    TwoPartyWarGame public game;

    // Rise VRF Coordinator address
    address constant VRF_COORDINATOR = 0x9d57aB4517ba97349551C876a01a7580B1338909;
    
    // Initial liquidity for betting payouts
    uint256 constant INITIAL_LIQUIDITY = 0.05 ether;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy GachaToken
        gachaToken = new GachaToken("GachaToken", "GACHA");

        // Deploy implementation contract
        implementation = new TwoPartyWarGame();

        // Encode the initialize function call
        bytes memory initData = abi.encodeWithSelector(
            TwoPartyWarGame.initialize.selector,
            VRF_COORDINATOR,
            address(gachaToken),
            msg.sender // owner
        );

        // Deploy proxy with implementation and initialization data
        proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to the game interface for easier interaction
        game = TwoPartyWarGame(payable(address(proxy)));

        // Configure bet amounts
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

        console.log("GachaToken deployed at:", address(gachaToken));
        console.log("Implementation deployed at:", address(implementation));
        console.log("Proxy deployed at:", address(proxy));
        console.log("TwoPartyWarGame (proxy) address:", address(game));
        console.log("VRF Coordinator:", VRF_COORDINATOR);
        console.log("Initial liquidity sent:", INITIAL_LIQUIDITY);
        console.log("\n=== IMPORTANT ===");
        console.log("Use the PROXY address for all interactions:", address(proxy));
        console.log("The implementation address is:", address(implementation));
    }
}

