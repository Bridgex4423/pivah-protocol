const { expect } = require("chai");
const { ethers } = require("hardhat");

const WAD = 10n ** 18n;

describe("PivahCollectionPool", function () {
  async function deploy() {
    const [owner, lp, trader] = await ethers.getSigners();

    const WETH = await ethers.getContractFactory("MockWETH");
    const weth = await WETH.deploy();

    const NFT = await ethers.getContractFactory("MockERC721");
    const nft = await NFT.deploy();

    const FeeManager = await ethers.getContractFactory("PivahFeeManager");
    const feeManager = await FeeManager.deploy(owner.address, owner.address, 50);

    const Factory = await ethers.getContractFactory("PivahPoolFactory");
    const factory = await Factory.deploy(owner.address, await feeManager.getAddress());
    await factory.setQuoteToken(await weth.getAddress(), true);

    // Price is not set here at all — createPool only fixes the curve shape
    // (linear/exponential + delta) and the LP fee. The starting price comes
    // from the ratio of the first addLiquidity deposit below.
    const tx = await factory.createPool(
      await nft.getAddress(),
      await weth.getAddress(),
      0, // LINEAR
      WAD / 50n, // 0.02 delta
      150,
    );
    const receipt = await tx.wait();
    const poolAddress = await factory.allPools(0);
    const pool = await ethers.getContractAt("PivahCollectionPool", poolAddress);
    expect(receipt.status).to.equal(1);

    // Seed LP with 5 NFTs + 2.5 WETH — ratio sets spot price at 0.5 WETH/NFT,
    // matching every downstream assertion in this file.
    const ids = [1, 2, 3, 4, 5];
    for (const id of ids) await nft.mint(lp.address, id);
    await weth.mint(lp.address, (5n * WAD) / 2n);
    await nft.connect(lp).setApprovalForAll(poolAddress, true);
    await weth.connect(lp).approve(poolAddress, ethers.MaxUint256);
    await pool.connect(lp).addLiquidity(ids, (5n * WAD) / 2n, 0, lp.address);

    await weth.mint(trader.address, 100n * WAD);
    await weth.connect(trader).approve(poolAddress, ethers.MaxUint256);

    return { owner, lp, trader, weth, nft, pool, feeManager };
  }

  it("derives the starting spot price from the first deposit's ratio", async function () {
    const { pool } = await deploy();
    // 2.5 WETH / 5 NFTs = 0.5 WETH per NFT — nobody typed that number in.
    expect(await pool.spotPrice()).to.equal(WAD / 2n);
  });

  it("mints LP shares for the seeded value", async function () {
    const { pool, lp } = await deploy();
    // value = 2.5 WETH + 5 * 0.5 = 5 WETH
    expect(await pool.poolValue()).to.equal(5n * WAD);
    expect(await pool.balanceOf(lp.address)).to.be.gt(0);
  });

  it("steps price up on buy and down on sell", async function () {
    const { pool, trader, weth } = await deploy();
    const [total] = await pool.quoteBuy(2);
    // subtotal = 0.5 + 0.52 = 1.02; fees = 2% => 1.0404
    expect(total).to.equal((1020n * WAD) / 1000n + (1020n * WAD * 200n) / (1000n * 10000n));

    await pool.connect(trader).buy([1, 2], total, trader.address, 2n ** 40n);
    expect(await pool.spotPrice()).to.equal(WAD / 2n + 2n * (WAD / 50n));
    expect(await pool.inventory()).to.equal(3);
    expect(await weth.balanceOf(await pool.getAddress())).to.be.gt((5n * WAD) / 2n);
  });

  it("returns both sides pro rata on removeLiquidity", async function () {
    const { pool, lp, nft, weth } = await deploy();
    const shares = await pool.balanceOf(lp.address);
    const nftBefore = await nft.balanceOf(lp.address);
    const wethBefore = await weth.balanceOf(lp.address);

    await pool.connect(lp).removeLiquidity(shares / 2n, 0, 0, lp.address);

    expect(await nft.balanceOf(lp.address)).to.be.gt(nftBefore);
    expect(await weth.balanceOf(lp.address)).to.be.gt(wethBefore);
    expect(await pool.balanceOf(lp.address)).to.equal(shares - shares / 2n);
  });

  it("rejects trades past the slippage bound", async function () {
    const { pool, trader } = await deploy();
    const [total] = await pool.quoteBuy(1);
    await expect(
      pool.connect(trader).buy([1], total - 1n, trader.address, 2n ** 40n),
    ).to.be.revertedWithCustomError(pool, "SlippageExceeded");
  });

  it("requires both NFTs and quote tokens on the very first deposit", async function () {
    const [owner, lp] = await ethers.getSigners();
    const WETH = await ethers.getContractFactory("MockWETH");
    const weth = await WETH.deploy();
    const NFT = await ethers.getContractFactory("MockERC721");
    const nft = await NFT.deploy();
    const FeeManager = await ethers.getContractFactory("PivahFeeManager");
    const feeManager = await FeeManager.deploy(owner.address, owner.address, 50);
    const Factory = await ethers.getContractFactory("PivahPoolFactory");
    const factory = await Factory.deploy(owner.address, await feeManager.getAddress());
    await factory.setQuoteToken(await weth.getAddress(), true);
    await factory.createPool(await nft.getAddress(), await weth.getAddress(), 0, WAD / 50n, 150);
    const poolAddress = await factory.allPools(0);
    const pool = await ethers.getContractAt("PivahCollectionPool", poolAddress);

    await nft.mint(lp.address, 1);
    await nft.connect(lp).setApprovalForAll(poolAddress, true);

    // NFTs only, no WETH — can't derive a ratio from one side alone.
    await expect(
      pool.connect(lp).addLiquidity([1], 0, 0, lp.address),
    ).to.be.revertedWithCustomError(pool, "PriceNotSet");
  });
});
