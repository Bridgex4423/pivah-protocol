// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PivahNftStakingVault
/// @notice Stake NFTs from any collection — Pivah-deployed or not — and earn
///         PIVAH continuously. Every staked NFT is one equal share of a
///         fixed per-second PIVAH emission; no per-collection weighting.
/// @dev Same O(1) accumulator pattern as a MasterChef-style farm, driven by
///      elapsed time * emission rate rather than external reward sweeps,
///      since NFTs don't arrive as a token flow the way fee income does.
///      The owner funds the vault with PIVAH and sets the emission rate;
///      if the vault runs dry, claims simply revert until it's topped up —
///      accounting keeps accruing correctly in the meantime.
contract PivahNftStakingVault is IERC721Receiver, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant ACC_PRECISION = 1e12;

    IERC20 public immutable rewardToken;

    uint256 public rewardRatePerSecond;
    uint256 public totalStaked;
    uint256 public accRewardPerNft;
    uint256 public lastUpdateTime;
    uint256 public nextStakeId = 1;

    struct StakedToken {
        address owner;
        address collection;
        uint256 tokenId;
    }

    struct UserInfo {
        uint256 count;
        uint256 rewardDebt;
        uint256 pendingClaim;
    }

    mapping(uint256 => StakedToken) public stakes;
    mapping(address => UserInfo) public users;

    event Staked(address indexed user, address indexed collection, uint256 indexed tokenId, uint256 stakeId);
    event Unstaked(address indexed user, address indexed collection, uint256 indexed tokenId, uint256 stakeId);
    event Claimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 ratePerSecond);
    event Funded(address indexed from, uint256 amount);

    error NotStaker();

    constructor(address rewardToken_, address owner_) Ownable(owner_) {
        rewardToken = IERC20(rewardToken_);
        lastUpdateTime = block.timestamp;
    }

    /// @notice Owner sets how much PIVAH is emitted per second, split across
    ///         every currently staked NFT.
    function setRewardRate(uint256 ratePerSecond) external onlyOwner {
        _update();
        rewardRatePerSecond = ratePerSecond;
        emit RewardRateUpdated(ratePerSecond);
    }

    /// @notice Anyone can top up the reward budget — typically the owner.
    function fund(uint256 amount) external {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    function pending(address user) external view returns (uint256) {
        UserInfo storage u = users[user];
        uint256 acc = accRewardPerNft;
        if (totalStaked > 0 && rewardRatePerSecond > 0 && block.timestamp > lastUpdateTime) {
            uint256 elapsed = block.timestamp - lastUpdateTime;
            acc += (elapsed * rewardRatePerSecond * ACC_PRECISION) / totalStaked;
        }
        return u.pendingClaim + ((u.count * acc) / ACC_PRECISION) - u.rewardDebt;
    }

    function stake(address collection, uint256 tokenId) external nonReentrant returns (uint256 stakeId) {
        stakeId = _stake(collection, tokenId);
    }

    function stakeBatch(address collection, uint256[] calldata tokenIds)
        external
        nonReentrant
        returns (uint256[] memory stakeIds)
    {
        stakeIds = new uint256[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            stakeIds[i] = _stake(collection, tokenIds[i]);
        }
    }

    function unstake(uint256 stakeId) external nonReentrant {
        _unstake(stakeId);
    }

    function unstakeBatch(uint256[] calldata stakeIds) external nonReentrant {
        for (uint256 i = 0; i < stakeIds.length; i++) {
            _unstake(stakeIds[i]);
        }
    }

    function claim() external nonReentrant returns (uint256 amount) {
        _update();
        UserInfo storage u = users[msg.sender];
        _accrue(u);

        amount = u.pendingClaim;
        if (amount == 0) return 0;
        u.pendingClaim = 0;
        rewardToken.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }

    function _stake(address collection, uint256 tokenId) internal returns (uint256 stakeId) {
        _update();
        UserInfo storage u = users[msg.sender];
        _accrue(u);

        IERC721(collection).safeTransferFrom(msg.sender, address(this), tokenId);

        stakeId = nextStakeId++;
        stakes[stakeId] = StakedToken(msg.sender, collection, tokenId);
        u.count += 1;
        totalStaked += 1;
        u.rewardDebt = (u.count * accRewardPerNft) / ACC_PRECISION;

        emit Staked(msg.sender, collection, tokenId, stakeId);
    }

    function _unstake(uint256 stakeId) internal {
        StakedToken memory s = stakes[stakeId];
        if (s.owner != msg.sender) revert NotStaker();

        _update();
        UserInfo storage u = users[msg.sender];
        _accrue(u);

        delete stakes[stakeId];
        u.count -= 1;
        totalStaked -= 1;
        u.rewardDebt = (u.count * accRewardPerNft) / ACC_PRECISION;

        IERC721(s.collection).safeTransferFrom(address(this), msg.sender, s.tokenId);

        emit Unstaked(msg.sender, s.collection, s.tokenId, stakeId);
    }

    function _update() internal {
        if (block.timestamp <= lastUpdateTime) return;
        uint256 elapsed = block.timestamp - lastUpdateTime;
        lastUpdateTime = block.timestamp;
        if (totalStaked == 0 || rewardRatePerSecond == 0) return;
        uint256 reward = elapsed * rewardRatePerSecond;
        accRewardPerNft += (reward * ACC_PRECISION) / totalStaked;
    }

    function _accrue(UserInfo storage u) private {
        if (u.count != 0) {
            uint256 accumulated = (u.count * accRewardPerNft) / ACC_PRECISION;
            u.pendingClaim += accumulated - u.rewardDebt;
            u.rewardDebt = accumulated;
        }
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
