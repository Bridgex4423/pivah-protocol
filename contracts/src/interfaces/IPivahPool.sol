// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PivahCurves} from "../libraries/PivahCurves.sol";

interface IPivahPool {
    struct PoolConfig {
        address collection;
        address quoteToken;
        PivahCurves.CurveType curve;
        uint256 spotPrice;
        uint256 delta;
        uint16 lpFeeBps;
    }

    function quoteBuy(uint256 count) external view returns (uint256 total, uint256 lpFee, uint256 protocolFee);
    function quoteSell(uint256 count) external view returns (uint256 total, uint256 lpFee, uint256 protocolFee);

    function buy(uint256[] calldata tokenIds, uint256 maxTotal, address to, uint256 deadline)
        external
        returns (uint256 total);

    function sell(uint256[] calldata tokenIds, uint256 minTotal, address to, uint256 deadline)
        external
        returns (uint256 total);

    function addLiquidity(uint256[] calldata tokenIds, uint256 quoteAmount, uint256 minSharesOut, address to)
        external
        returns (uint256 sharesMinted);

    function removeLiquidity(uint256 shares, uint256 minNftsOut, uint256 minQuoteOut, address to)
        external
        returns (uint256[] memory tokenIds, uint256 quoteOut);

    function spotPrice() external view returns (uint256);
    function inventory() external view returns (uint256);
    function quoteReserves() external view returns (uint256);
}
