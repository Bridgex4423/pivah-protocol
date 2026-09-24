// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title PivahCollection
/// @notice ERC-721 collection deployed by Creator Studio. Supports a public
///         mint phase with a price, per-wallet cap and max supply, plus
///         creator royalties (ERC-2981) and a freezable metadata base URI.
contract PivahCollection is ERC721Enumerable, ERC2981, Ownable {
    using Strings for uint256;

    uint256 public immutable maxSupply;
    uint256 public mintPrice;
    uint256 public maxPerWallet;
    bool public mintOpen;
    bool public metadataFrozen;

    string private _baseTokenURI;
    uint256 private _nextId = 1;
    address public withdrawAddress;

    event MintConfigUpdated(uint256 price, uint256 maxPerWallet, bool open);
    event BaseURIUpdated(string baseURI);
    event MetadataFrozen();

    error SoldOut();
    error MintClosed();
    error WrongPayment();
    error WalletCapReached();
    error Frozen();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 maxPerWallet_,
        address owner_,
        address royaltyReceiver,
        uint96 royaltyBps
    ) ERC721(name_, symbol_) Ownable(owner_) {
        _baseTokenURI = baseURI_;
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        maxPerWallet = maxPerWallet_;
        withdrawAddress = owner_;
        _setDefaultRoyalty(royaltyReceiver, royaltyBps);
    }

    function mint(uint256 quantity) external payable {
        if (!mintOpen) revert MintClosed();
        if (totalSupply() + quantity > maxSupply) revert SoldOut();
        if (msg.value != mintPrice * quantity) revert WrongPayment();
        if (maxPerWallet != 0 && balanceOf(msg.sender) + quantity > maxPerWallet) revert WalletCapReached();

        for (uint256 i; i < quantity; ++i) {
            _safeMint(msg.sender, _nextId++);
        }
    }

    /// @notice Owner mint for team allocations and seeding a liquidity pool.
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        if (totalSupply() + quantity > maxSupply) revert SoldOut();
        for (uint256 i; i < quantity; ++i) {
            _safeMint(to, _nextId++);
        }
    }

    function setMintConfig(uint256 price, uint256 walletCap, bool open) external onlyOwner {
        mintPrice = price;
        maxPerWallet = walletCap;
        mintOpen = open;
        emit MintConfigUpdated(price, walletCap, open);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        if (metadataFrozen) revert Frozen();
        _baseTokenURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    function freezeMetadata() external onlyOwner {
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    function setRoyalty(address receiver, uint96 bps) external onlyOwner {
        _setDefaultRoyalty(receiver, bps);
    }

    function withdraw() external {
        (bool ok,) = withdrawAddress.call{value: address(this).balance}("");
        require(ok, "Pivah: withdraw failed");
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
