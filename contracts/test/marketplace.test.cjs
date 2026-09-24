const { expect } = require("chai");
const { ethers } = require("hardhat");

const WAD = 10n ** 18n;

describe("PivahMarketplace", function () {
  async function deploy() {
    const [owner, seller, buyer] = await ethers.getSigners();

    const WETH = await ethers.getContractFactory("MockWETH");
    const weth = await WETH.deploy();

    const NFT = await ethers.getContractFactory("MockERC721");
    const nft = await NFT.deploy();

    const FeeManager = await ethers.getContractFactory("PivahFeeManager");
    // 50 bps protocol fee
    const feeManager = await FeeManager.deploy(owner.address, owner.address, 50);

    const Marketplace = await ethers.getContractFactory("PivahMarketplace");
    const marketplace = await Marketplace.deploy(await feeManager.getAddress());
    const marketplaceAddress = await marketplace.getAddress();

    for (const id of [1, 2, 3, 4, 5]) await nft.mint(seller.address, id);
    await nft.connect(seller).setApprovalForAll(marketplaceAddress, true);

    await weth.mint(buyer.address, 100n * WAD);
    await weth.connect(buyer).approve(marketplaceAddress, ethers.MaxUint256);

    return { owner, seller, buyer, weth, nft, feeManager, marketplace, marketplaceAddress };
  }

  it("lists and buys a single token, splitting protocol fee correctly", async function () {
    const { seller, buyer, weth, nft, feeManager, marketplace, marketplaceAddress } =
      await deploy();

    const price = 1n * WAD;
    await marketplace
      .connect(seller)
      .list(await nft.getAddress(), 1, await weth.getAddress(), price, 0);

    await expect(marketplace.connect(buyer).buy(1)).to.changeTokenBalances(
      weth,
      [buyer, seller, feeManager],
      [-price, (price * 9950n) / 10_000n, (price * 50n) / 10_000n],
    );
    expect(await nft.ownerOf(1)).to.equal(buyer.address);

    const listing = await marketplace.listings(1);
    expect(listing.active).to.equal(false);
  });

  it("listBatch lists every token id with one call, no per-token approval needed", async function () {
    const { seller, marketplace, nft, weth } = await deploy();

    const tx = await marketplace
      .connect(seller)
      .listBatch(await nft.getAddress(), [1, 2, 3, 4, 5], await weth.getAddress(), WAD, 0);
    await tx.wait();

    for (let id = 1; id <= 5; id++) {
      const listing = await marketplace.listings(id);
      expect(listing.active).to.equal(true);
      expect(listing.tokenId).to.equal(id);
      expect(listing.seller).to.equal(seller.address);
    }
    expect(await marketplace.nextListingId()).to.equal(6);
  });

  it("listBatch reverts entirely if any token isn't owned by the caller", async function () {
    const { seller, buyer, marketplace, nft, weth } = await deploy();
    // token 6 exists but is owned by buyer, not seller
    await nft.mint(buyer.address, 6);
    await expect(
      marketplace
        .connect(seller)
        .listBatch(await nft.getAddress(), [1, 2, 6], await weth.getAddress(), WAD, 0),
    ).to.be.revertedWithCustomError(marketplace, "NotOwner");

    // and nothing partial got listed either — token 1 should still be listable fresh
    expect(await marketplace.nextListingId()).to.equal(1);
  });

  it("moves the NFT into escrow the moment it's listed — no longer stakeable or poolable by the seller", async function () {
    const { seller, marketplace, marketplaceAddress, nft, weth } = await deploy();
    expect(await nft.ownerOf(1)).to.equal(seller.address);

    await marketplace
      .connect(seller)
      .list(await nft.getAddress(), 1, await weth.getAddress(), WAD, 0);

    // The whole point: once listed, the seller genuinely doesn't own it
    // anymore, so any other contract requiring ownership (staking, DEX
    // liquidity) naturally can't touch it either — no cross-contract check
    // needed, ownership itself is the guard.
    expect(await nft.ownerOf(1)).to.equal(marketplaceAddress);
  });

  it("returns the NFT to the seller on cancel", async function () {
    const { seller, marketplace, marketplaceAddress, nft, weth } = await deploy();
    await marketplace
      .connect(seller)
      .list(await nft.getAddress(), 1, await weth.getAddress(), WAD, 0);
    expect(await nft.ownerOf(1)).to.equal(marketplaceAddress);

    await marketplace.connect(seller).cancelListing(1);
    expect(await nft.ownerOf(1)).to.equal(seller.address);
  });

  it("cancelling a listing lets only the seller do it", async function () {
    const { seller, buyer, marketplace, nft, weth } = await deploy();
    await marketplace
      .connect(seller)
      .list(await nft.getAddress(), 1, await weth.getAddress(), WAD, 0);

    await expect(marketplace.connect(buyer).cancelListing(1)).to.be.revertedWithCustomError(
      marketplace,
      "NotSeller",
    );

    await marketplace.connect(seller).cancelListing(1);
    const listing = await marketplace.listings(1);
    expect(listing.active).to.equal(false);
  });

  it("listBatchWithPrices gives each token its own price, e.g. rarer traits worth more", async function () {
    const { seller, buyer, marketplace, nft, weth } = await deploy();

    const prices = [WAD, 3n * WAD, 2n * WAD, 5n * WAD, WAD / 2n];
    await marketplace
      .connect(seller)
      .listBatchWithPrices(
        await nft.getAddress(),
        [1, 2, 3, 4, 5],
        await weth.getAddress(),
        prices,
        0,
      );

    for (let i = 0; i < 5; i++) {
      const listing = await marketplace.listings(i + 1);
      expect(listing.price).to.equal(prices[i]);
      expect(listing.tokenId).to.equal(i + 1);
    }

    // Buying the pricier one actually charges the pricier amount, not a shared price.
    await expect(marketplace.connect(buyer).buy(4)).to.changeTokenBalance(weth, buyer, -(5n * WAD));
  });

  it("listBatchWithPrices reverts if tokenIds and prices are different lengths", async function () {
    const { seller, marketplace, nft, weth } = await deploy();
    await expect(
      marketplace
        .connect(seller)
        .listBatchWithPrices(
          await nft.getAddress(),
          [1, 2, 3],
          await weth.getAddress(),
          [WAD, WAD],
          0,
        ),
    ).to.be.revertedWithCustomError(marketplace, "LengthMismatch");
  });
});
