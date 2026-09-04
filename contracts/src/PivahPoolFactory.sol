// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {PivahCollectionPool} from "./PivahCollectionPool.sol";
import {PivahCurves} from "./libraries/PivahCurves.sol";

/// @title PivahPoolFactory
/// @notice Deploys and registers collection liquidity pools.
/// @dev One canonical pool per (collection, quoteToken, curve, delta) tuple keeps
///      liquidity from fragmenting; extra pools for the same pair are still
///      allowed but are not returned by `canonicalPool`.
contract PivahPoolFactory is Ownable {
    address public feeManager;
    /// @notice Quote tokens the protocol allows (WETH, USDC, ...).
    mapping(address => bool) public quoteTokenAllowed;

    address[] public allPools;
    mapping(bytes32 => address) public canonicalPool;
    mapping(address => address[]) public poolsByCollection;

    event PoolCreated(
        address indexed pool,
        address indexed collection,
        address indexed quoteToken,
        PivahCurves.CurveType curve,
        uint256 delta,
        uint16 lpFeeBps
    );
    event QuoteTokenSet(address token, bool allowed);
    event FeeManagerUpdated(address feeManager);

    error QuoteTokenNotAllowed();
    error InvalidParams();

    constructor(address owner_, address feeManager_) Ownable(owner_) {
        feeManager = feeManager_;
    }

    function setQuoteToken(address token, bool allowed) external onlyOwner {
        quoteTokenAllowed[token] = allowed;
        emit QuoteTokenSet(token, allowed);
    }

    function setFeeManager(address feeManager_) external onlyOwner {
        feeManager = feeManager_;
        emit FeeManagerUpdated(feeManager_);
    }

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }

    function poolsFor(address collection) external view returns (address[] memory) {
        return poolsByCollection[collection];
    }

    function poolKey(address collection, address quoteToken, PivahCurves.CurveType curve, uint256 delta)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(collection, quoteToken, curve, delta));
    }

    /// @notice Deploy a pool. Price is NOT set here — it's derived
    ///         automatically from the ratio of the first `addLiquidity`
    ///         deposit (NFTs and quote tokens together), the same way
    ///         Uniswap V2 derives a pair's starting price from the first
    ///         LP's deposit ratio rather than a number typed in beforehand.
    function createPool(
        address collection,
        address quoteToken,
        PivahCurves.CurveType curve,
        uint256 delta,
        uint16 lpFeeBps
    ) external returns (address pool) {
        if (!quoteTokenAllowed[quoteToken]) revert QuoteTokenNotAllowed();
        if (collection == address(0)) revert InvalidParams();
        if (curve == PivahCurves.CurveType.EXPONENTIAL && delta < PivahCurves.WAD) revert InvalidParams();

        pool = address(new PivahCollectionPool(collection, quoteToken, feeManager, curve, delta, lpFeeBps));

        allPools.push(pool);
        poolsByCollection[collection].push(pool);

        bytes32 key = poolKey(collection, quoteToken, curve, delta);
        if (canonicalPool[key] == address(0)) canonicalPool[key] = pool;

        emit PoolCreated(pool, collection, quoteToken, curve, delta, lpFeeBps);
    }
}
