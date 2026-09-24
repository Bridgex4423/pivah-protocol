// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PivahFeeManager
/// @notice Single sink for protocol fees taken by pools and the marketplace.
/// @dev Fees accrue per token here and sweep entirely to the treasury.
///      Pools read `protocolFeeBps` so governance can retune fees without
///      redeploying pools.
///
///      This contract previously supported splitting swept fees with a
///      staking vault, from an earlier design where staking rewarded WETH
///      for staked PIVAH. That model was replaced with PivahNftStakingVault
///      (stake NFTs, earn PIVAH via a pull-based `fund()` call) — a design
///      this fee-sweep model is fundamentally incompatible with, both in
///      token type (WETH fees vs. a PIVAH-only reward pool) and mechanism
///      (this contract pushes tokens; the vault only accounts for tokens it
///      pulls via `fund()`). A raw push transfer to the vault would leave
///      funds permanently stuck with no rescue path, so that integration
///      point has been removed rather than left dormant and exploitable by
///      a future misconfiguration. If staking should draw from protocol
///      fees again, it needs a dedicated swap-and-fund flow, not this.
contract PivahFeeManager is Ownable {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_PROTOCOL_FEE_BPS = 200; // 2% hard cap

    uint16 public protocolFeeBps;
    address public treasury;

    event ProtocolFeeUpdated(uint16 bps);
    event TreasuryUpdated(address treasury);
    event FeesSwept(address indexed token, uint256 toTreasury);

    error FeeTooHigh();
    error ZeroAddress();

    constructor(address owner_, address treasury_, uint16 protocolFeeBps_) Ownable(owner_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        if (protocolFeeBps_ > MAX_PROTOCOL_FEE_BPS) revert FeeTooHigh();
        treasury = treasury_;
        protocolFeeBps = protocolFeeBps_;
    }

    function setProtocolFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_PROTOCOL_FEE_BPS) revert FeeTooHigh();
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(bps);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Sweep the accrued balance of `token` to the treasury.
    function sweep(address token) external {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) return;

        IERC20(token).safeTransfer(treasury, balance);
        emit FeesSwept(token, balance);
    }
}
