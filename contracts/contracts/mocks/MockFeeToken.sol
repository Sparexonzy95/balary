// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/** Test-only token that can charge a transfer fee when a chosen sender transfers. */
contract MockFeeToken is ERC20 {
    uint8 private immutable _tokenDecimals;
    address public feeSender;
    uint256 public feeBps;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFee(address sender, uint256 bps) external {
        require(bps <= 1_000, "fee too high");
        feeSender = sender;
        feeBps = bps;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == feeSender && to != address(0) && feeBps != 0) {
            uint256 fee = (value * feeBps) / 10_000;
            super._update(from, address(0xdead), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}
