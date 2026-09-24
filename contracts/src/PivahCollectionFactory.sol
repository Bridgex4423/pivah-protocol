// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PivahCollection} from "./PivahCollection.sol";

/// @title PivahCollectionFactory
/// @notice Deploys creator collections and indexes them by creator so the
///         Creator Studio can list a wallet's projects without a backend.
contract PivahCollectionFactory {
    address[] public allCollections;
    mapping(address => address[]) public collectionsByCreator;

    event CollectionDeployed(
        address indexed collection,
        address indexed creator,
        string name,
        string symbol,
        uint256 maxSupply,
        uint256 mintPrice
    );

    function deploy(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 maxPerWallet_,
        address royaltyReceiver,
        uint96 royaltyBps
    ) external returns (address collection) {
        collection = address(
            new PivahCollection(
                name_,
                symbol_,
                baseURI_,
                maxSupply_,
                mintPrice_,
                maxPerWallet_,
                msg.sender,
                royaltyReceiver,
                royaltyBps
            )
        );

        allCollections.push(collection);
        collectionsByCreator[msg.sender].push(collection);

        emit CollectionDeployed(collection, msg.sender, name_, symbol_, maxSupply_, mintPrice_);
    }

    function collectionCount() external view returns (uint256) {
        return allCollections.length;
    }

    function creatorCollections(address creator) external view returns (address[] memory) {
        return collectionsByCreator[creator];
    }
}
