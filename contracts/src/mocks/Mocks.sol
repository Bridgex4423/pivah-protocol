// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev Test-only helpers. Not deployed to production networks.
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockERC721 is ERC721 {
    constructor() ERC721("Mock", "MOCK") {}

    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }
}
