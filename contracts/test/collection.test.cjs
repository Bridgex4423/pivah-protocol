const { expect } = require("chai");
const { ethers } = require("hardhat");

const WAD = 10n ** 18n;

describe("PivahCollection", function () {
  async function deploy() {
    const [owner, buyer, other] = await ethers.getSigners();

    const Collection = await ethers.getContractFactory("PivahCollection");
    const collection = await Collection.deploy(
      "Test Collection",
      "TEST",
      "https://example.com/meta/",
      10, // maxSupply
      WAD / 100n, // mintPrice = 0.01 ETH
      3, // maxPerWallet
      owner.address,
      owner.address, // royaltyReceiver
      500, // 5% royalty
    );

    return { owner, buyer, other, collection };
  }

  it("ownerMint is restricted to the owner and respects max supply", async function () {
    const { owner, buyer, other, collection } = await deploy();

    await expect(
      collection.connect(other).ownerMint(other.address, 1),
    ).to.be.revertedWithCustomError(collection, "OwnableUnauthorizedAccount");

    await collection.connect(owner).ownerMint(buyer.address, 4);
    expect(await collection.balanceOf(buyer.address)).to.equal(4);
    expect(await collection.totalSupply()).to.equal(4);

    // maxSupply is 10 — minting 7 more should overflow it and revert.
    await expect(
      collection.connect(owner).ownerMint(buyer.address, 7),
    ).to.be.revertedWithCustomError(collection, "SoldOut");
  });

  it("public mint is closed until setMintConfig opens it, then enforces price and wallet cap", async function () {
    const { owner, buyer, collection } = await deploy();

    await expect(
      collection.connect(buyer).mint(1, { value: WAD / 100n }),
    ).to.be.revertedWithCustomError(collection, "MintClosed");

    await collection.connect(owner).setMintConfig(WAD / 100n, 3, true);

    await expect(
      collection.connect(buyer).mint(1, { value: WAD / 200n }),
    ).to.be.revertedWithCustomError(collection, "WrongPayment");

    await collection.connect(buyer).mint(3, { value: (3n * WAD) / 100n });
    expect(await collection.balanceOf(buyer.address)).to.equal(3);

    // maxPerWallet is 3 — a 4th mint to the same wallet must revert.
    await expect(
      collection.connect(buyer).mint(1, { value: WAD / 100n }),
    ).to.be.revertedWithCustomError(collection, "WalletCapReached");
  });

  it("setMintConfig is owner-only", async function () {
    const { other, collection } = await deploy();
    await expect(collection.connect(other).setMintConfig(0, 0, true)).to.be.revertedWithCustomError(
      collection,
      "OwnableUnauthorizedAccount",
    );
  });

  it("freezeMetadata is permanent — setBaseURI reverts afterward, even for the owner", async function () {
    const { owner, collection } = await deploy();

    await collection.connect(owner).setBaseURI("https://updated.example.com/");
    await collection.connect(owner).freezeMetadata();

    await expect(
      collection.connect(owner).setBaseURI("https://sneaky-change.example.com/"),
    ).to.be.revertedWithCustomError(collection, "Frozen");
  });

  it("setBaseURI and freezeMetadata are owner-only", async function () {
    const { other, collection } = await deploy();
    await expect(
      collection.connect(other).setBaseURI("https://evil.example.com/"),
    ).to.be.revertedWithCustomError(collection, "OwnableUnauthorizedAccount");
    await expect(collection.connect(other).freezeMetadata()).to.be.revertedWithCustomError(
      collection,
      "OwnableUnauthorizedAccount",
    );
  });

  it("honours ERC-2981 royalties as configured at deploy, and setRoyalty updates them", async function () {
    const { owner, buyer, collection } = await deploy();
    const [receiver, amount] = await collection.royaltyInfo(1, WAD);
    expect(receiver).to.equal(owner.address);
    expect(amount).to.equal(WAD / 20n); // 5%

    await collection.connect(owner).setRoyalty(buyer.address, 1000); // 10%
    const [receiver2, amount2] = await collection.royaltyInfo(1, WAD);
    expect(receiver2).to.equal(buyer.address);
    expect(amount2).to.equal(WAD / 10n);
  });

  it("withdraw sends the contract's ETH balance to withdrawAddress regardless of caller", async function () {
    const { owner, buyer, other, collection } = await deploy();
    await collection.connect(owner).setMintConfig(WAD / 100n, 0, true);
    await collection.connect(buyer).mint(2, { value: (2n * WAD) / 100n });

    const before = await ethers.provider.getBalance(owner.address);
    // Anyone can call withdraw() — but funds only ever go to withdrawAddress (the owner),
    // never to whoever happens to call it.
    await collection.connect(other).withdraw();
    const after = await ethers.provider.getBalance(owner.address);

    expect(after - before).to.equal((2n * WAD) / 100n);
  });
});
