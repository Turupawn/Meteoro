// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    uint256 public constant MINT_AMOUNT = 1000 * 1e6; // 1000 USDC per mint
    uint256 public constant MINT_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastMintTime;

    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Public mint function - anyone can mint test USDC
    /// @dev Rate limited to prevent abuse
    function mint() external {
        require(
            block.timestamp >= lastMintTime[msg.sender] + MINT_COOLDOWN,
            "Mint cooldown not elapsed"
        );
        lastMintTime[msg.sender] = block.timestamp;
        _mint(msg.sender, MINT_AMOUNT);
    }

    /// @notice Check remaining cooldown time
    function mintCooldownRemaining(address account) external view returns (uint256) {
        uint256 nextMintTime = lastMintTime[account] + MINT_COOLDOWN;
        if (block.timestamp >= nextMintTime) return 0;
        return nextMintTime - block.timestamp;
    }
}
