// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PivahCurves
/// @notice Discrete bonding-curve math for NFT liquidity pools.
/// @dev Prices step per NFT traded. NFTs are not fungible reserve units, so
///      constant-product math is never used. The TypeScript mirror in
///      src/lib/pivah/curve.ts must stay byte-for-byte equivalent to this file.
library PivahCurves {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;

    enum CurveType {
        LINEAR,
        EXPONENTIAL
    }

    error InvalidDelta();
    error CurveFloorReached();

    /// @notice Price of the next unit when the pool sells one NFT out.
    function stepUp(CurveType curve, uint256 price, uint256 delta) internal pure returns (uint256) {
        if (curve == CurveType.LINEAR) return price + delta;
        if (delta < WAD) revert InvalidDelta();
        return (price * delta) / WAD;
    }

    /// @notice Price of the next unit when the pool buys one NFT in.
    function stepDown(CurveType curve, uint256 price, uint256 delta) internal pure returns (uint256) {
        if (curve == CurveType.LINEAR) return price > delta ? price - delta : 0;
        if (delta < WAD) revert InvalidDelta();
        return (price * WAD) / delta;
    }

    /// @notice Cost of buying `count` NFTs out of the pool, before fees.
    /// @return subtotal Sum of the individual step prices.
    /// @return newSpot  Spot price after the trade.
    function buyCost(CurveType curve, uint256 spotPrice, uint256 delta, uint256 count)
        internal
        pure
        returns (uint256 subtotal, uint256 newSpot)
    {
        newSpot = spotPrice;
        for (uint256 i; i < count; ++i) {
            subtotal += newSpot;
            newSpot = stepUp(curve, newSpot, delta);
        }
    }

    /// @notice Proceeds from selling `count` NFTs into the pool, before fees.
    /// @dev The first unit trades one step below spot, which is the pool spread.
    function sellProceeds(CurveType curve, uint256 spotPrice, uint256 delta, uint256 count)
        internal
        pure
        returns (uint256 subtotal, uint256 newSpot)
    {
        uint256 price = stepDown(curve, spotPrice, delta);
        for (uint256 i; i < count; ++i) {
            if (price == 0) revert CurveFloorReached();
            subtotal += price;
            price = stepDown(curve, price, delta);
        }
        // Spot always points at the price of the NEXT buy.
        newSpot = stepUp(curve, price, delta);
    }
}
