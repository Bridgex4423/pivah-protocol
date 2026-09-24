// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title PivahToken
/// @notice The PIVAH protocol token. Fixed supply, minted entirely to the
///         deployer at construction — no owner-only mint function, so the
///         cap can never be inflated later. Holders can burn their own
///         balance via {ERC20Burnable}.
/// @dev Stake this token in {PivahStakingVault} to earn a share of protocol
///      fees (paid out in WETH, the quote token used across pools, the
///      router and the marketplace).
contract PivahToken is ERC20, ERC20Burnable {
    /// @notice 1,000,000,000 PIVAH, 18 decimals, minted once to `initialHolder`.
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 ether;

    constructor(address initialHolder) ERC20("Pivah Protocol", "PIVAH") {
        _mint(initialHolder, INITIAL_SUPPLY);
    }
}
