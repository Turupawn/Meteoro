// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {TwoPartyWarGame} from "../src/TwoPartyWarGame.sol";

contract UpdateBetAmountsScript is Script {
    function setUp() public {}

    function run(address gameAddress) public {
        require(gameAddress != address(0), "Game address cannot be zero");

        vm.startBroadcast();

        TwoPartyWarGame game = TwoPartyWarGame(payable(gameAddress));

        IERC20Metadata usdc = IERC20Metadata(address(game.usdcToken()));
        uint8 decimals = usdc.decimals();
        uint256 decimalUnits = 10 ** decimals;

        uint[] memory betAmounts = new uint[](3);
        betAmounts[0] = 1 * decimalUnits;   // $1
        betAmounts[1] = 5 * decimalUnits;   // $5
        betAmounts[2] = 10 * decimalUnits;  // $10

        game.setBetAmounts(betAmounts);

        game.setBetAmountMultiplier(1 * decimalUnits, 1);
        game.setBetAmountMultiplier(5 * decimalUnits, 5);
        game.setBetAmountMultiplier(10 * decimalUnits, 10);

        vm.stopBroadcast();

        console.log("Updated game at:", address(game));
        console.log("USDC decimals:", decimals);
        console.log("New bet amounts: $1, $5, $10 USDC");
        console.log("New multipliers: 1, 5, 10");
    }
}
