// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {GachaToken} from "../src/GachaToken.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract DeployAllScript is Script {
    MockUSDC public mockUsdc;
    GachaToken public gachaToken;
    TwoPartyWarGame public implementation;
    ERC1967Proxy public proxy;
    TwoPartyWarGame public game;

    // Rise VRF Coordinator address
    address constant VRF_COORDINATOR = 0xc0d49A572cF25aC3e9ae21B939e8B619b39291Ea;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        mockUsdc = new MockUSDC();
        gachaToken = new GachaToken("GachaToken", "GACHA");
        implementation = new TwoPartyWarGame();

        uint8 decimals = mockUsdc.decimals();
        uint256 decimalUnits = 10 ** decimals;

        bytes memory initData = abi.encodeWithSelector(
            TwoPartyWarGame.initialize.selector,
            VRF_COORDINATOR,
            address(gachaToken),
            address(mockUsdc),
            msg.sender
        );

        proxy = new ERC1967Proxy(address(implementation), initData);
        game = TwoPartyWarGame(payable(address(proxy)));

        uint[] memory betAmounts = new uint[](3);
        betAmounts[0] = 1 * decimalUnits;   // $1
        betAmounts[1] = 5 * decimalUnits;   // $5
        betAmounts[2] = 10 * decimalUnits;  // $10
        game.setBetAmounts(betAmounts);

        game.setBetAmountMultiplier(1 * decimalUnits, 1);
        game.setBetAmountMultiplier(5 * decimalUnits, 5);
        game.setBetAmountMultiplier(10 * decimalUnits, 10);

        gachaToken.setMinter(address(game), true);

        uint256 initialLiquidity = 1000 * decimalUnits;
        mockUsdc.mint();
        mockUsdc.approve(address(game), initialLiquidity);
        game.depositFunds(initialLiquidity);

        vm.stopBroadcast();

        console.log("=== Deployed Contracts ===");
        console.log("MockUSDC deployed at:", address(mockUsdc));
        console.log("GachaToken deployed at:", address(gachaToken));
        console.log("Implementation deployed at:", address(implementation));
        console.log("Proxy deployed at:", address(proxy));
        console.log("TwoPartyWarGame (proxy) address:", address(game));
        console.log("VRF Coordinator:", VRF_COORDINATOR);
        console.log("Token decimals:", decimals);
        console.log("Initial USDC liquidity:", initialLiquidity);
        console.log("\n=== IMPORTANT ===");
        console.log("Use the PROXY address for all interactions:", address(proxy));
    }
}
