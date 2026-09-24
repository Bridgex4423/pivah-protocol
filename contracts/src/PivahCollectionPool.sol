// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {PivahCurves} from "./libraries/PivahCurves.sol";
import {PivahFeeManager} from "./PivahFeeManager.sol";

/// @title PivahCollectionPool
/// @notice A two-sided NFT/quote-token liquidity pool priced by a discrete
///         bonding curve. Anyone (typically the project founder) can deposit
///         NFTs + quote tokens to become an LP and withdraw pro rata later,
///         exactly like a PancakeSwap pair — except one side is non-fungible.
///
/// LP accounting
/// -------------
/// The pool is itself an ERC20 LP token. Pool value is measured in quote units:
///
///     poolValue = quoteReserves + inventory * spotPrice
///
/// Deposits mint `shares = valueAdded * totalSupply / poolValueBefore`
/// (or `valueAdded` for the first deposit). Withdrawals burn shares and return
/// a pro-rata slice of BOTH sides. Trading fees accrue to `quoteReserves`, so
/// every share is continuously worth more — LPs never claim fees separately.
contract PivahCollectionPool is ERC20, IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PivahCurves for PivahCurves.CurveType;

    uint256 private constant MIN_LIQUIDITY = 1e3;

    IERC721 public immutable collection;
    IERC20 public immutable quoteToken;
    PivahFeeManager public immutable feeManager;
    address public immutable factory;

    PivahCurves.CurveType public curve;
    uint256 public spotPrice;
    uint256 public delta;
    uint16 public lpFeeBps;

    /// @notice Token ids currently held by the pool.
    uint256[] private _inventory;
    /// @notice tokenId => index+1 inside `_inventory` (0 means absent).
    mapping(uint256 => uint256) private _inventoryIndex;
    /// @notice Quote tokens owned by LPs (excludes in-flight transfers).
    uint256 public quoteReserves;

    event Buy(address indexed trader, uint256[] tokenIds, uint256 total, uint256 newSpot);
    event Sell(address indexed trader, uint256[] tokenIds, uint256 total, uint256 newSpot);
    event LiquidityAdded(address indexed provider, uint256 nftCount, uint256 quoteAmount, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 nftCount, uint256 quoteAmount, uint256 shares);

    error Expired();
    error SlippageExceeded();
    error InsufficientInventory();
    error InsufficientQuote();
    error NothingToDo();
    error NotFactory();
    error FeeTooHigh();
    error PriceNotSet();

    constructor(
        address collection_,
        address quoteToken_,
        address feeManager_,
        PivahCurves.CurveType curve_,
        uint256 delta_,
        uint16 lpFeeBps_
    ) ERC20("Pivah Pool LP", "PIVAH-LP") {
        if (lpFeeBps_ > 1_000) revert FeeTooHigh();
        collection = IERC721(collection_);
        quoteToken = IERC20(quoteToken_);
        feeManager = PivahFeeManager(feeManager_);
        factory = msg.sender;
        curve = curve_;
        delta = delta_;
        lpFeeBps = lpFeeBps_;
        // spotPrice starts at 0 — set automatically on the first
        // addLiquidity call, from the ratio of what's actually deposited.
    }

    // ---------------------------------------------------------------- views

    function inventory() public view returns (uint256) {
        return _inventory.length;
    }

    function inventoryAt(uint256 i) external view returns (uint256) {
        return _inventory[i];
    }

    function allInventory() external view returns (uint256[] memory) {
        return _inventory;
    }

    /// @notice Pool value denominated in quote tokens.
    function poolValue() public view returns (uint256) {
        return quoteReserves + _inventory.length * spotPrice;
    }

    /// @notice Authoritative buy quote. The UI mirror is advisory only.
    function quoteBuy(uint256 count) public view returns (uint256 total, uint256 lpFee, uint256 protocolFee) {
        if (count == 0 || count > _inventory.length) revert InsufficientInventory();
        (uint256 subtotal,) = PivahCurves.buyCost(curve, spotPrice, delta, count);
        lpFee = (subtotal * lpFeeBps) / PivahCurves.BPS;
        protocolFee = (subtotal * feeManager.protocolFeeBps()) / PivahCurves.BPS;
        total = subtotal + lpFee + protocolFee;
    }

    /// @notice Authoritative sell quote.
    function quoteSell(uint256 count) public view returns (uint256 total, uint256 lpFee, uint256 protocolFee) {
        if (count == 0) revert NothingToDo();
        (uint256 subtotal,) = PivahCurves.sellProceeds(curve, spotPrice, delta, count);
        lpFee = (subtotal * lpFeeBps) / PivahCurves.BPS;
        protocolFee = (subtotal * feeManager.protocolFeeBps()) / PivahCurves.BPS;
        total = subtotal - lpFee - protocolFee;
    }

    // --------------------------------------------------------------- trading

    /// @notice Buy specific NFTs out of the pool.
    function buy(uint256[] calldata tokenIds, uint256 maxTotal, address to, uint256 deadline)
        external
        nonReentrant
        returns (uint256 total)
    {
        if (block.timestamp > deadline) revert Expired();
        uint256 count = tokenIds.length;
        (uint256 subtotal, uint256 newSpot) = PivahCurves.buyCost(curve, spotPrice, delta, count);
        uint256 lpFee = (subtotal * lpFeeBps) / PivahCurves.BPS;
        uint256 protocolFee = (subtotal * feeManager.protocolFeeBps()) / PivahCurves.BPS;
        total = subtotal + lpFee + protocolFee;
        if (total > maxTotal) revert SlippageExceeded();

        quoteToken.safeTransferFrom(msg.sender, address(this), total);
        if (protocolFee != 0) quoteToken.safeTransfer(address(feeManager), protocolFee);
        // subtotal + lpFee stays with LPs.
        quoteReserves += subtotal + lpFee;

        spotPrice = newSpot;
        for (uint256 i; i < count; ++i) {
            _removeFromInventory(tokenIds[i]);
            collection.safeTransferFrom(address(this), to, tokenIds[i]);
        }

        emit Buy(msg.sender, tokenIds, total, newSpot);
    }

    /// @notice Sell NFTs into the pool for quote tokens.
    function sell(uint256[] calldata tokenIds, uint256 minTotal, address to, uint256 deadline)
        external
        nonReentrant
        returns (uint256 total)
    {
        if (block.timestamp > deadline) revert Expired();
        uint256 count = tokenIds.length;
        if (count == 0) revert NothingToDo();

        (uint256 subtotal, uint256 newSpot) = PivahCurves.sellProceeds(curve, spotPrice, delta, count);
        uint256 lpFee = (subtotal * lpFeeBps) / PivahCurves.BPS;
        uint256 protocolFee = (subtotal * feeManager.protocolFeeBps()) / PivahCurves.BPS;
        total = subtotal - lpFee - protocolFee;
        if (total < minTotal) revert SlippageExceeded();
        if (total + protocolFee > quoteReserves) revert InsufficientQuote();

        for (uint256 i; i < count; ++i) {
            collection.safeTransferFrom(msg.sender, address(this), tokenIds[i]);
        }

        // LPs pay out `total`, keep `lpFee`, and forward `protocolFee`.
        quoteReserves -= (total + protocolFee);
        spotPrice = newSpot;

        if (protocolFee != 0) quoteToken.safeTransfer(address(feeManager), protocolFee);
        quoteToken.safeTransfer(to, total);

        emit Sell(msg.sender, tokenIds, total, newSpot);
    }

    // -------------------------------------------------------------- liquidity

    /// @notice Deposit NFTs and/or quote tokens and mint LP shares.
    /// @dev Caller must approve the collection and the quote token first.
    ///      Adding liquidity never moves the spot price after it's set —
    ///      depth grows, price does not. The very first deposit is special:
    ///      it must include both NFTs and quote tokens, and the ratio
    ///      between them becomes the pool's starting price — nobody has to
    ///      guess a number before any real liquidity exists.
    function addLiquidity(uint256[] calldata tokenIds, uint256 quoteAmount, uint256 minSharesOut, address to)
        external
        nonReentrant
        returns (uint256 sharesMinted)
    {
        uint256 count = tokenIds.length;
        if (count == 0 && quoteAmount == 0) revert NothingToDo();

        uint256 supply = totalSupply();

        if (supply == 0 && spotPrice == 0) {
            if (count == 0 || quoteAmount == 0) revert PriceNotSet();
            spotPrice = quoteAmount / count;
            if (spotPrice == 0) revert PriceNotSet();
        }

        uint256 valueBefore = poolValue();
        uint256 valueAdded = quoteAmount + count * spotPrice;

        if (supply == 0) {
            sharesMinted = valueAdded > MIN_LIQUIDITY ? valueAdded - MIN_LIQUIDITY : 0;
            _mint(address(this), MIN_LIQUIDITY); // permanently locked
        } else {
            sharesMinted = (valueAdded * supply) / valueBefore;
        }
        if (sharesMinted < minSharesOut || sharesMinted == 0) revert SlippageExceeded();

        for (uint256 i; i < count; ++i) {
            collection.safeTransferFrom(msg.sender, address(this), tokenIds[i]);
        }
        if (quoteAmount != 0) {
            quoteToken.safeTransferFrom(msg.sender, address(this), quoteAmount);
            quoteReserves += quoteAmount;
        }

        _mint(to, sharesMinted);
        emit LiquidityAdded(msg.sender, count, quoteAmount, sharesMinted);
    }

    /// @notice Burn LP shares and withdraw a pro-rata slice of both sides.
    function removeLiquidity(uint256 shares, uint256 minNftsOut, uint256 minQuoteOut, address to)
        external
        nonReentrant
        returns (uint256[] memory tokenIds, uint256 quoteOut)
    {
        if (shares == 0) revert NothingToDo();
        uint256 supply = totalSupply();

        uint256 nftsOut = (_inventory.length * shares) / supply;
        quoteOut = (quoteReserves * shares) / supply;
        if (nftsOut < minNftsOut || quoteOut < minQuoteOut) revert SlippageExceeded();
        if (nftsOut == 0 && quoteOut == 0) revert NothingToDo();

        _burn(msg.sender, shares);

        tokenIds = new uint256[](nftsOut);
        for (uint256 i; i < nftsOut; ++i) {
            uint256 tokenId = _inventory[_inventory.length - 1];
            tokenIds[i] = tokenId;
            _removeFromInventory(tokenId);
            collection.safeTransferFrom(address(this), to, tokenId);
        }

        if (quoteOut != 0) {
            quoteReserves -= quoteOut;
            quoteToken.safeTransfer(to, quoteOut);
        }

        emit LiquidityRemoved(msg.sender, nftsOut, quoteOut, shares);
    }

    /// @notice Quote-token value one LP share currently redeems for.
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (poolValue() * 1e18) / supply;
    }

    // --------------------------------------------------------------- internal

    function _removeFromInventory(uint256 tokenId) private {
        uint256 idx = _inventoryIndex[tokenId];
        if (idx == 0) revert InsufficientInventory();
        uint256 i = idx - 1;
        uint256 last = _inventory.length - 1;
        if (i != last) {
            uint256 moved = _inventory[last];
            _inventory[i] = moved;
            _inventoryIndex[moved] = i + 1;
        }
        _inventory.pop();
        delete _inventoryIndex[tokenId];
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata)
        external
        override
        returns (bytes4)
    {
        // Only track ids from this pool's collection; stray NFTs are rejected.
        require(msg.sender == address(collection), "Pivah: wrong collection");
        if (_inventoryIndex[tokenId] == 0) {
            _inventory.push(tokenId);
            _inventoryIndex[tokenId] = _inventory.length;
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}
