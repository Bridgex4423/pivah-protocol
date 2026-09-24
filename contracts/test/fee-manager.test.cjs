const { expect } = require("chai");
const { ethers } = require("hardhat");

const WAD = 10n ** 18n;

describe("PivahFeeManager", function () {
  async function deploy() {
    const [owner, treasury, other] = await ethers.getSigners();
    const FeeManager = await ethers.getContractFactory("PivahFeeManager");
    const feeManager = await FeeManager.deploy(owner.address, treasury.address, 150);

    const WETH = await ethers.getContractFactory("MockWETH");
    const weth = await WETH.deploy();

    return { owner, treasury, other, feeManager, weth };
  }

  it("rejects a zero treasury address at construction", async function () {
    const [owner] = await ethers.getSigners();
    const FeeManager = await ethers.getContractFactory("PivahFeeManager");
    await expect(
      FeeManager.deploy(owner.address, ethers.ZeroAddress, 150),
    ).to.be.revertedWithCustomError(FeeManager, "ZeroAddress");
  });

  it("rejects a protocol fee above the 2% hard cap at construction and via setter", async function () {
    const [owner, treasury] = await ethers.getSigners();
    const FeeManager = await ethers.getContractFactory("PivahFeeManager");
    await expect(
      FeeManager.deploy(owner.address, treasury.address, 201),
    ).to.be.revertedWithCustomError(FeeManager, "FeeTooHigh");

    const { feeManager } = await deploy();
    await expect(feeManager.setProtocolFeeBps(201)).to.be.revertedWithCustomError(
      feeManager,
      "FeeTooHigh",
    );
    // exactly at the cap should succeed
    await expect(feeManager.setProtocolFeeBps(200)).to.not.be.reverted;
  });

  it("setProtocolFeeBps and setTreasury are owner-only", async function () {
    const { other, feeManager } = await deploy();
    await expect(feeManager.connect(other).setProtocolFeeBps(100)).to.be.revertedWithCustomError(
      feeManager,
      "OwnableUnauthorizedAccount",
    );
    await expect(
      feeManager.connect(other).setTreasury(other.address),
    ).to.be.revertedWithCustomError(feeManager, "OwnableUnauthorizedAccount");
  });

  it("setTreasury rejects the zero address", async function () {
    const { feeManager } = await deploy();
    await expect(feeManager.setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      feeManager,
      "ZeroAddress",
    );
  });

  it("sweep sends the full accrued balance of a token to the treasury", async function () {
    const { treasury, feeManager, weth } = await deploy();
    await weth.mint(await feeManager.getAddress(), 10n * WAD);

    await expect(feeManager.sweep(await weth.getAddress())).to.changeTokenBalance(
      weth,
      treasury,
      10n * WAD,
    );
    expect(await weth.balanceOf(await feeManager.getAddress())).to.equal(0);
  });

  it("sweep is callable by anyone — the destination is fixed regardless of caller", async function () {
    const { other, treasury, feeManager, weth } = await deploy();
    await weth.mint(await feeManager.getAddress(), 5n * WAD);

    await expect(feeManager.connect(other).sweep(await weth.getAddress())).to.changeTokenBalance(
      weth,
      treasury,
      5n * WAD,
    );
    // The caller (`other`) never receives anything, regardless of who triggers the sweep.
    expect(await weth.balanceOf(other.address)).to.equal(0);
  });

  it("sweep is a safe no-op when the balance is zero", async function () {
    const { feeManager, weth } = await deploy();
    await expect(feeManager.sweep(await weth.getAddress())).to.not.be.reverted;
  });
});
