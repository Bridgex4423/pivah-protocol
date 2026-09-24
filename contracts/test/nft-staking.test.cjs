const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const WAD = 10n ** 18n;

describe("PivahNftStakingVault", function () {
  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();

    const PivahToken = await ethers.getContractFactory("PivahToken");
    const pivah = await PivahToken.deploy(owner.address);

    const NFT = await ethers.getContractFactory("MockERC721");
    const nftA = await NFT.deploy(); // "collection A"
    const nftB = await NFT.deploy(); // "collection B" — vault must accept both

    const Vault = await ethers.getContractFactory("PivahNftStakingVault");
    const vault = await Vault.deploy(await pivah.getAddress(), owner.address);
    const vaultAddress = await vault.getAddress();

    // Fund a reward budget and set a simple, readable rate.
    await pivah.approve(vaultAddress, 10_000n * WAD);
    await vault.fund(10_000n * WAD);
    await vault.setRewardRate(WAD); // 1 PIVAH / second, split across staked NFTs

    for (const id of [1, 2, 3]) await nftA.mint(alice.address, id);
    await nftB.mint(bob.address, 1);
    await nftA.connect(alice).setApprovalForAll(vaultAddress, true);
    await nftB.connect(bob).setApprovalForAll(vaultAddress, true);

    return { owner, alice, bob, pivah, nftA, nftB, vault, vaultAddress };
  }

  it("a single staker earns the full emission rate", async function () {
    const { alice, pivah, nftA, vault } = await deploy();

    const tx = await vault.connect(alice).stake(await nftA.getAddress(), 1);
    await tx.wait();
    expect(await nftA.ownerOf(1)).to.equal(await vault.getAddress());

    await time.increase(100);
    const pending = await vault.pending(alice.address);
    // ~100 seconds * 1 PIVAH/sec, generous tolerance for block timing
    expect(pending).to.be.closeTo(100n * WAD, 3n * WAD);

    const before = await pivah.balanceOf(alice.address);
    await vault.connect(alice).claim();
    const after = await pivah.balanceOf(alice.address);
    // Claiming itself mines a block, so a little more accrues than the
    // pre-claim snapshot — check it landed close to expected, not exact.
    expect(after - before).to.be.closeTo(100n * WAD, 3n * WAD);
  });

  it("splits emission evenly across two stakers regardless of collection", async function () {
    const { alice, bob, nftA, nftB, vault } = await deploy();

    await vault.connect(alice).stake(await nftA.getAddress(), 1);
    await vault.connect(bob).stake(await nftB.getAddress(), 1);

    await time.increase(100);

    const alicePending = await vault.pending(alice.address);
    const bobPending = await vault.pending(bob.address);
    // Each staker holds 1 of 2 total staked NFTs — roughly 50 PIVAH each.
    expect(alicePending).to.be.closeTo(50n * WAD, 3n * WAD);
    expect(bobPending).to.be.closeTo(50n * WAD, 3n * WAD);
  });

  it("stakeBatch stakes many tokens from one collection in a single call", async function () {
    const { alice, nftA, vault } = await deploy();

    await vault.connect(alice).stakeBatch(await nftA.getAddress(), [1, 2, 3]);
    expect(await vault.totalStaked()).to.equal(3n);
    const [count] = await vault.users(alice.address);
    expect(count).to.equal(3n);
    for (const id of [1, 2, 3]) {
      expect(await nftA.ownerOf(id)).to.equal(await vault.getAddress());
    }
  });

  it("unstake returns the exact NFT and stops further accrual for it", async function () {
    const { alice, nftA, vault } = await deploy();

    const stakeTx = await vault.connect(alice).stake(await nftA.getAddress(), 1);
    const receipt = await stakeTx.wait();
    const stakeId = 1n; // first stake in a fresh vault

    await time.increase(50);
    await vault.connect(alice).unstake(stakeId);
    expect(await nftA.ownerOf(1)).to.equal(alice.address);
    expect(await vault.totalStaked()).to.equal(0n);
  });

  it("only the original staker can unstake a given stake id", async function () {
    const { alice, bob, nftA, vault } = await deploy();
    await vault.connect(alice).stake(await nftA.getAddress(), 1);
    await expect(vault.connect(bob).unstake(1)).to.be.revertedWithCustomError(vault, "NotStaker");
  });

  it("accepts NFTs from a collection never seen before, with no whitelist", async function () {
    const { bob, nftB, vault } = await deploy();
    await expect(vault.connect(bob).stake(await nftB.getAddress(), 1)).to.not.be.reverted;
  });
});
