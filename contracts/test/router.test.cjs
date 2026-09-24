const { expect } = require("chai");
const { ethers } = require("hardhat");

const WAD = 10n ** 18n;

describe("PivahRouter", function () {
  async function deploy() {
    const [owner, lp, trader] = await ethers.getSigners();

    const WETH = await ethers.getContractFactory("MockWETH");
    const weth = await WETH.deploy();

    const NFT = await ethers.getContractFactory("MockERC721");
    const nftA = await NFT.deploy();
    const nftB = await NFT.deploy();

    const FeeManager = await ethers.getContractFactory("PivahFeeManager");
    const feeManager = await FeeManager.deploy(owner.address, owner.address, 200);

    const Factory = await ethers.getContractFactory("PivahPoolFactory");
    const factory = await Factory.deploy(owner.address, await feeManager.getAddress());
    await factory.setQuoteToken(await weth.getAddress(), true);

    const Router = await ethers.getContractFactory("PivahRouter");
    const router = await Router.deploy(await weth.getAddress());
    const routerAddress = await router.getAddress();

    // Pool A: seeded so LP holds tokens 1-5, spot price derives to 0.5 WETH.
    await factory.createPool(await nftA.getAddress(), await weth.getAddress(), 0, WAD / 50n, 150);
    const poolAAddress = await factory.allPools(0);
    const poolA = await ethers.getContractAt("PivahCollectionPool", poolAAddress);

    for (const id of [1, 2, 3, 4, 5]) await nftA.mint(lp.address, id);
    await weth.mint(lp.address, (5n * WAD) / 2n);
    await nftA.connect(lp).setApprovalForAll(poolAAddress, true);
    await weth.connect(lp).approve(poolAAddress, ethers.MaxUint256);
    await poolA.connect(lp).addLiquidity([1, 2, 3, 4, 5], (5n * WAD) / 2n, 0, lp.address);

    // Pool B: separate collection, seeded the same way, for the NFT-for-NFT swap test.
    await factory.createPool(await nftB.getAddress(), await weth.getAddress(), 0, WAD / 50n, 150);
    const poolBAddress = await factory.allPools(1);
    const poolB = await ethers.getContractAt("PivahCollectionPool", poolBAddress);

    for (const id of [1, 2, 3]) await nftB.mint(lp.address, id);
    await weth.mint(lp.address, (3n * WAD) / 2n);
    await nftB.connect(lp).setApprovalForAll(poolBAddress, true);
    await weth.connect(lp).approve(poolBAddress, ethers.MaxUint256);
    await poolB.connect(lp).addLiquidity([1, 2, 3], (3n * WAD) / 2n, 0, lp.address);

    return {
      owner,
      lp,
      trader,
      weth,
      nftA,
      nftB,
      router,
      routerAddress,
      poolA,
      poolAAddress,
      poolB,
      poolBAddress,
    };
  }

  it("buyWithETH wraps ETH, buys, and refunds unused dust", async function () {
    const { trader, router, poolA, poolAAddress } = await deploy();
    const [total] = await poolA.quoteBuy(1);
    const overpay = total + WAD / 10n; // send extra on purpose

    const balBefore = await ethers.provider.getBalance(trader.address);
    const tx = await router
      .connect(trader)
      .buyWithETH(poolAAddress, [1], trader.address, 2n ** 40n, { value: overpay });
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(trader.address);

    // Trader should be down by exactly `total` + gas — the dust must have come back.
    expect(balBefore - balAfter).to.equal(total + gasCost);
  });

  it("buyWithETH reverts if msg.value can't cover the quoted total (slippage)", async function () {
    const { trader, router, poolA, poolAAddress } = await deploy();
    const [total] = await poolA.quoteBuy(1);
    await expect(
      router.connect(trader).buyWithETH(poolAAddress, [1], trader.address, 2n ** 40n, {
        value: total - 1n,
      }),
    ).to.be.revertedWithCustomError(router, "SlippageExceeded");
  });

  it("buyWithETH reverts past its deadline", async function () {
    const { trader, router, poolA, poolAAddress } = await deploy();
    const [total] = await poolA.quoteBuy(1);
    await expect(
      router.connect(trader).buyWithETH(poolAAddress, [1], trader.address, 1n, { value: total }),
    ).to.be.revertedWithCustomError(router, "Expired");
  });

  it("sellForETH takes the NFT and pays out native ETH", async function () {
    const { lp, trader, weth, nftA, router, routerAddress, poolA, poolAAddress } = await deploy();

    // Buy token #1 first so trader actually owns something to sell back.
    const [buyTotal] = await poolA.quoteBuy(1);
    await router.connect(trader).buyWithETH(poolAAddress, [1], trader.address, 2n ** 40n, {
      value: buyTotal,
    });
    expect(await nftA.ownerOf(1)).to.equal(trader.address);

    await nftA.connect(trader).setApprovalForAll(routerAddress, true);
    const [sellOut] = await poolA.quoteSell(1);

    const balBefore = await ethers.provider.getBalance(trader.address);
    const tx = await router
      .connect(trader)
      .sellForETH(poolAAddress, [1], sellOut, trader.address, 2n ** 40n);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(trader.address);

    expect(await nftA.ownerOf(1)).to.equal(poolAAddress);
    expect(balAfter - balBefore).to.equal(sellOut - gasCost);
  });

  it("sellForETH reverts if the payout would be below minOut", async function () {
    const { trader, router, routerAddress, poolA, poolAAddress, nftA } = await deploy();
    const [buyTotal] = await poolA.quoteBuy(1);
    await router.connect(trader).buyWithETH(poolAAddress, [1], trader.address, 2n ** 40n, {
      value: buyTotal,
    });
    await nftA.connect(trader).setApprovalForAll(routerAddress, true);
    const [sellOut] = await poolA.quoteSell(1);

    await expect(
      router.connect(trader).sellForETH(poolAAddress, [1], sellOut + 1n, trader.address, 2n ** 40n),
    ).to.be.revertedWithCustomError(poolA, "SlippageExceeded");
  });

  it("swapNftForNft moves an NFT from pool A's collection to pool B's in one transaction", async function () {
    const {
      trader,
      weth,
      router,
      routerAddress,
      poolA,
      poolAAddress,
      poolB,
      poolBAddress,
      nftA,
      nftB,
    } = await deploy();

    // Give trader token #2 from collection A to sell into pool A.
    const [buyTotal] = await poolA.quoteBuy(1);
    await router.connect(trader).buyWithETH(poolAAddress, [2], trader.address, 2n ** 40n, {
      value: buyTotal,
    });
    await nftA.connect(trader).setApprovalForAll(routerAddress, true);

    // Trader may need to top up if buying out of pool B costs more than selling into A returns.
    await weth.mint(trader.address, 10n * WAD);
    await weth.connect(trader).approve(routerAddress, ethers.MaxUint256);

    await router
      .connect(trader)
      .swapNftForNft(poolAAddress, [2], poolBAddress, [1], 10n * WAD, trader.address, 2n ** 40n);

    expect(await nftA.ownerOf(2)).to.equal(poolAAddress);
    expect(await nftB.ownerOf(1)).to.equal(trader.address);
  });

  it("swapNftForNft reverts if the top-up required exceeds maxExtraIn", async function () {
    const { trader, weth, router, routerAddress, poolA, poolAAddress, poolB, poolBAddress, nftA } =
      await deploy();
    const [buyTotal] = await poolA.quoteBuy(1);
    await router.connect(trader).buyWithETH(poolAAddress, [2], trader.address, 2n ** 40n, {
      value: buyTotal,
    });
    await nftA.connect(trader).setApprovalForAll(routerAddress, true);
    await weth.mint(trader.address, 10n * WAD);
    await weth.connect(trader).approve(routerAddress, ethers.MaxUint256);

    await expect(
      router
        .connect(trader)
        .swapNftForNft(poolAAddress, [2], poolBAddress, [1], 0, trader.address, 2n ** 40n),
    ).to.be.revertedWithCustomError(router, "SlippageExceeded");
  });
});
