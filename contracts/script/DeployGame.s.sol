// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {GachaToken} from "../src/GachaToken.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract DeployGameScript is Script {
    TwoPartyWarGame public implementation;
    ERC1967Proxy public proxy;
    TwoPartyWarGame public game;

    address constant VRF_COORDINATOR = 0xc0d49A572cF25aC3e9ae21B939e8B619b39291Ea;

    function setUp() public {}

    function run(address gachaTokenAddress, address usdcAddress) public {
        require(gachaTokenAddress != address(0), "GachaToken address cannot be zero");
        require(usdcAddress != address(0), "USDC address cannot be zero");

        vm.startBroadcast();

        GachaToken gachaToken = GachaToken(gachaTokenAddress);
        IERC20Metadata usdc = IERC20Metadata(usdcAddress);

        uint8 decimals = usdc.decimals();
        uint256 decimalUnits = 10 ** decimals;

        implementation = new TwoPartyWarGame();

        bytes memory initData = abi.encodeWithSelector(
            TwoPartyWarGame.initialize.selector,
            VRF_COORDINATOR,
            address(gachaToken),
            usdcAddress,
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

        vm.stopBroadcast();

        console.log("=== Deployed Contracts ===");
        console.log("Using existing USDC at:", usdcAddress);
        console.log("Using existing GachaToken at:", address(gachaToken));
        console.log("Implementation deployed at:", address(implementation));
        console.log("Proxy deployed at:", address(proxy));
        console.log("TwoPartyWarGame (proxy) address:", address(game));
        console.log("VRF Coordinator:", VRF_COORDINATOR);
        console.log("Token decimals:", decimals);
        console.log("\n=== IMPORTANT ===");
        console.log("Use the PROXY address for all interactions:", address(proxy));
        console.log("Remember to deposit USDC liquidity using depositFunds()");
    }
}

