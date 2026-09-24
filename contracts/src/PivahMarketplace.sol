// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {PivahFeeManager} from "./PivahFeeManager.sol";

/// @title PivahMarketplace
/// @notice Peer-to-peer listings and collection/token offers, settled in a
///         quote ERC20. Listings are escrowed: the NFT moves into this
///         contract the moment it's listed and comes back on cancel, the
///         same custody model as the DEX pools and the staking vault. That
///         means a listed NFT genuinely can't also be staked or pooled
///         somewhere else at the same time — the seller simply doesn't hold
///         it anymore until they cancel or it sells. Creator royalties are
///         honoured via ERC-2981. Offers are unescrowed on the buyer's side
///         (there's nothing of the buyer's to hold until acceptance).
contract PivahMarketplace is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        address collection;
        uint256 tokenId;
        address quoteToken;
        uint256 price;
        uint64 expiry;
        bool active;
    }

    struct Offer {
        address buyer;
        address collection;
        /// @dev `tokenId` is ignored when `collectionWide` is true.
        uint256 tokenId;
        bool collectionWide;
        address quoteToken;
        uint256 price;
        uint64 expiry;
        bool active;
    }

    PivahFeeManager public immutable feeManager;

    uint256 public nextListingId = 1;
    uint256 public nextOfferId = 1;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Offer) public offers;

    event Listed(uint256 indexed id, address indexed seller, address indexed collection, uint256 tokenId, uint256 price);
    event ListingCancelled(uint256 indexed id);
    event Sold(uint256 indexed id, address indexed buyer, uint256 price, uint256 royalty, uint256 protocolFee);
    event OfferMade(uint256 indexed id, address indexed buyer, address indexed collection, uint256 price, bool collectionWide);
    event OfferCancelled(uint256 indexed id);
    event OfferAccepted(uint256 indexed id, address indexed seller, uint256 tokenId, uint256 price);

    error NotOwner();
    error NotSeller();
    error NotBuyer();
    error Inactive();
    error Expired();
    error WrongToken();
    error ZeroPrice();
    error LengthMismatch();

    constructor(address feeManager_) {
        feeManager = PivahFeeManager(feeManager_);
    }

    // --------------------------------------------------------------- listings

    function list(address collection, uint256 tokenId, address quoteToken, uint256 price, uint64 expiry)
        external
        returns (uint256 id)
    {
        id = _list(collection, tokenId, quoteToken, price, expiry);
    }

    /// @notice List many token ids from the same collection at once — one
    ///         approval (setApprovalForAll) already covers every token, so
    ///         this turns what would be N wallet confirmations into one.
    ///         Every token shares the same quote token, price and expiry;
    ///         call `list` individually, or `listBatchWithPrices`, for
    ///         per-token pricing.
    function listBatch(
        address collection,
        uint256[] calldata tokenIds,
        address quoteToken,
        uint256 price,
        uint64 expiry
    ) external returns (uint256[] memory ids) {
        ids = new uint256[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            ids[i] = _list(collection, tokenIds[i], quoteToken, price, expiry);
        }
    }

    /// @notice Same as `listBatch`, but each token gets its own price —
    ///         e.g. listing a whole trait-based collection where rarer
    ///         combinations are worth more, all in one transaction.
    ///         `tokenIds` and `prices` must be the same length, index-matched.
    function listBatchWithPrices(
        address collection,
        uint256[] calldata tokenIds,
        address quoteToken,
        uint256[] calldata prices,
        uint64 expiry
    ) external returns (uint256[] memory ids) {
        if (tokenIds.length != prices.length) revert LengthMismatch();
        ids = new uint256[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            ids[i] = _list(collection, tokenIds[i], quoteToken, prices[i], expiry);
        }
    }

    function _list(address collection, uint256 tokenId, address quoteToken, uint256 price, uint64 expiry)
        internal
        returns (uint256 id)
    {
        if (price == 0) revert ZeroPrice();
        if (IERC721(collection).ownerOf(tokenId) != msg.sender) revert NotOwner();

        id = nextListingId++;
        listings[id] = Listing(msg.sender, collection, tokenId, quoteToken, price, expiry, true);
        IERC721(collection).safeTransferFrom(msg.sender, address(this), tokenId);
        emit Listed(id, msg.sender, collection, tokenId, price);
    }

    function cancelListing(uint256 id) external {
        Listing storage l = listings[id];
        if (l.seller != msg.sender) revert NotSeller();
        if (!l.active) revert Inactive();
        l.active = false;
        IERC721(l.collection).safeTransferFrom(address(this), msg.sender, l.tokenId);
        emit ListingCancelled(id);
    }

    function buy(uint256 id) external nonReentrant {
        Listing storage l = listings[id];
        if (!l.active) revert Inactive();
        if (l.expiry != 0 && block.timestamp > l.expiry) revert Expired();
        l.active = false;

        (uint256 royalty, address royaltyReceiver) = _royalty(l.collection, l.tokenId, l.price);
        uint256 protocolFee = (l.price * feeManager.protocolFeeBps()) / 10_000;
        uint256 sellerProceeds = l.price - royalty - protocolFee;

        IERC20 quote = IERC20(l.quoteToken);
        quote.safeTransferFrom(msg.sender, l.seller, sellerProceeds);
        if (royalty != 0) quote.safeTransferFrom(msg.sender, royaltyReceiver, royalty);
        if (protocolFee != 0) quote.safeTransferFrom(msg.sender, address(feeManager), protocolFee);

        IERC721(l.collection).safeTransferFrom(address(this), msg.sender, l.tokenId);
        emit Sold(id, msg.sender, l.price, royalty, protocolFee);
    }

    // ----------------------------------------------------------------- offers

    function makeOffer(
        address collection,
        uint256 tokenId,
        bool collectionWide,
        address quoteToken,
        uint256 price,
        uint64 expiry
    ) external returns (uint256 id) {
        if (price == 0) revert ZeroPrice();
        id = nextOfferId++;
        offers[id] = Offer(msg.sender, collection, tokenId, collectionWide, quoteToken, price, expiry, true);
        emit OfferMade(id, msg.sender, collection, price, collectionWide);
    }

    function cancelOffer(uint256 id) external {
        Offer storage o = offers[id];
        if (o.buyer != msg.sender) revert NotBuyer();
        if (!o.active) revert Inactive();
        o.active = false;
        emit OfferCancelled(id);
    }

    /// @notice Owner of `tokenId` accepts an outstanding offer.
    function acceptOffer(uint256 id, uint256 tokenId) external nonReentrant {
        Offer storage o = offers[id];
        if (!o.active) revert Inactive();
        if (o.expiry != 0 && block.timestamp > o.expiry) revert Expired();
        if (!o.collectionWide && o.tokenId != tokenId) revert WrongToken();
        if (IERC721(o.collection).ownerOf(tokenId) != msg.sender) revert NotOwner();
        o.active = false;

        (uint256 royalty, address royaltyReceiver) = _royalty(o.collection, tokenId, o.price);
        uint256 protocolFee = (o.price * feeManager.protocolFeeBps()) / 10_000;
        uint256 sellerProceeds = o.price - royalty - protocolFee;

        IERC20 quote = IERC20(o.quoteToken);
        quote.safeTransferFrom(o.buyer, msg.sender, sellerProceeds);
        if (royalty != 0) quote.safeTransferFrom(o.buyer, royaltyReceiver, royalty);
        if (protocolFee != 0) quote.safeTransferFrom(o.buyer, address(feeManager), protocolFee);

        IERC721(o.collection).safeTransferFrom(msg.sender, o.buyer, tokenId);
        emit OfferAccepted(id, msg.sender, tokenId, o.price);
    }

    // --------------------------------------------------------------- internal

    function _royalty(address collection, uint256 tokenId, uint256 price)
        private
        view
        returns (uint256 amount, address receiver)
    {
        if (!ERC165Checker.supportsInterface(collection, type(IERC2981).interfaceId)) return (0, address(0));
        (receiver, amount) = IERC2981(collection).royaltyInfo(tokenId, price);
        if (receiver == address(0)) amount = 0;
        // Cap royalties at 10% so listings cannot be griefed by a malicious hook.
        uint256 cap = (price * 1_000) / 10_000;
        if (amount > cap) amount = cap;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
