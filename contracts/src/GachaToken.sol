// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GachaToken is ERC20, Ownable {
    mapping(address => bool) public isMinter;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) Ownable(msg.sender) {
    }

    function setMinter(address minter, bool isMinter_) public onlyOwner {
        isMinter[minter] = isMinter_;
    }

    function mint(address to, uint256 amount) public {
        require(isMinter[msg.sender], "Not a minter");
        _mint(to, amount);
    }
}
