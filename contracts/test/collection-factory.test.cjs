const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PivahCollectionFactory", function () {
  async function deploy() {
    const [alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PivahCollectionFactory");
    const factory = await Factory.deploy();
    return { alice, bob, factory };
  }

  it("deploys a collection and attributes ownership to the caller, not the factory", async function () {
    const { alice, factory } = await deploy();

    const tx = await factory
      .connect(alice)
      .deploy("My Collection", "MYC", "https://example.com/meta/", 100, 0, 0, alice.address, 500);
    const receipt = await tx.wait();

    expect(await factory.collectionCount()).to.equal(1);
    const collectionAddress = await factory.allCollections(0);

    const collection = await ethers.getContractAt("PivahCollection", collectionAddress);
    expect(await collection.owner()).to.equal(alice.address);
    expect(await collection.name()).to.equal("My Collection");

    const event = receipt.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "CollectionDeployed");
    expect(event.args.creator).to.equal(alice.address);
    expect(event.args.collection).to.equal(collectionAddress);
  });

  it("indexes collections per creator, keeping different wallets' lists separate", async function () {
    const { alice, bob, factory } = await deploy();

    await factory.connect(alice).deploy("A1", "A1", "uri/", 10, 0, 0, alice.address, 0);
    await factory.connect(alice).deploy("A2", "A2", "uri/", 10, 0, 0, alice.address, 0);
    await factory.connect(bob).deploy("B1", "B1", "uri/", 10, 0, 0, bob.address, 0);

    expect(await factory.collectionCount()).to.equal(3);
    const aliceCollections = await factory.creatorCollections(alice.address);
    const bobCollections = await factory.creatorCollections(bob.address);
    expect(aliceCollections.length).to.equal(2);
    expect(bobCollections.length).to.equal(1);
  });

  it("has no access control on deploy — anyone can deploy a collection, matching the open-platform design", async function () {
    const { bob, factory } = await deploy();
    await expect(factory.connect(bob).deploy("Anyone's", "ANY", "uri/", 10, 0, 0, bob.address, 0))
      .to.not.be.reverted;
  });
});
