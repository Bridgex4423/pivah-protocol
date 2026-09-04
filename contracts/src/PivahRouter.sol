// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {PivahCollectionPool} from "./PivahCollectionPool.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

/// @title PivahRouter
/// @notice Single entry point for trading: native-ETH wrapping, multi-pool
///         routing, and atomic NFT-to-NFT swaps (sell leg into pool A, buy leg
///         out of pool B). Any failing leg reverts the whole transaction.
contract PivahRouter is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IWETH public immutable weth;

    error Expired();
    error SlippageExceeded();
    error EthTransferFailed();

    constructor(address weth_) {
        weth = IWETH(weth_);
    }

    modifier ensure(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    /// @notice Buy NFTs from a pool paying with native ETH; dust is refunded.
    function buyWithETH(address pool, uint256[] calldata tokenIds, address to, uint256 deadline)
        external
        payable
        nonReentrant
        ensure(deadline)
        returns (uint256 spent)
    {
        PivahCollectionPool p = PivahCollectionPool(pool);
        (uint256 total,,) = p.quoteBuy(tokenIds.length);
        if (total > msg.value) revert SlippageExceeded();

        weth.deposit{value: total}();
        weth.approve(pool, total);
        spent = p.buy(tokenIds, total, to, deadline);

        uint256 refund = msg.value - spent;
        if (refund != 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            if (!ok) revert EthTransferFailed();
        }
    }

    /// @notice Sell NFTs into a pool and receive native ETH.
    function sellForETH(address pool, uint256[] calldata tokenIds, uint256 minOut, address to, uint256 deadline)
        external
        nonReentrant
        ensure(deadline)
        returns (uint256 received)
    {
        PivahCollectionPool p = PivahCollectionPool(pool);
        IERC721 collection = p.collection();

        for (uint256 i; i < tokenIds.length; ++i) {
            collection.safeTransferFrom(msg.sender, address(this), tokenIds[i]);
        }
        collection.setApprovalForAll(pool, true);

        received = p.sell(tokenIds, minOut, address(this), deadline);
        weth.withdraw(received);

        (bool ok,) = to.call{value: received}("");
        if (!ok) revert EthTransferFailed();
    }

    /// @notice Atomic NFT-to-NFT swap routed through the quote token.
    /// @param sellPool  Pool that absorbs `sellIds`.
    /// @param buyPool   Pool that releases `buyIds`.
    /// @param maxExtraIn Extra quote tokens the caller will top up if the buy
    ///                   leg costs more than the sell leg returns.
    function swapNftForNft(
        address sellPool,
        uint256[] calldata sellIds,
        address buyPool,
        uint256[] calldata buyIds,
        uint256 maxExtraIn,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256 extraIn, uint256 refundOut) {
        PivahCollectionPool sp = PivahCollectionPool(sellPool);
        PivahCollectionPool bp = PivahCollectionPool(buyPool);
        IERC20 quote = sp.quoteToken();
        require(address(quote) == address(bp.quoteToken()), "Pivah: quote mismatch");

        IERC721 sellCollection = sp.collection();
        for (uint256 i; i < sellIds.length; ++i) {
            sellCollection.safeTransferFrom(msg.sender, address(this), sellIds[i]);
        }
        sellCollection.setApprovalForAll(sellPool, true);
        uint256 proceeds = sp.sell(sellIds, 0, address(this), deadline);

        (uint256 cost,,) = bp.quoteBuy(buyIds.length);
        if (cost > proceeds) {
            extraIn = cost - proceeds;
            if (extraIn > maxExtraIn) revert SlippageExceeded();
            quote.safeTransferFrom(msg.sender, address(this), extraIn);
        } else {
            refundOut = proceeds - cost;
        }

        quote.forceApprove(buyPool, cost);
        bp.buy(buyIds, cost, to, deadline);

        if (refundOut != 0) quote.safeTransfer(msg.sender, refundOut);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}
