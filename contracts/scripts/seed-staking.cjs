const { ethers } = require("hardhat");

// Fill these in if the main deploy script warned that seeding failed —
// copy the pivahToken and stakingVault addresses it already printed you.
const PIVAH_TOKEN = process.env.PIVAH_TOKEN_ADDRESS || "";
const STAKING_VAULT = process.env.STAKING_VAULT_ADDRESS || "";

async function main() {
  if (!PIVAH_TOKEN || !STAKING_VAULT) {
    throw new Error(
      "Set PIVAH_TOKEN_ADDRESS and STAKING_VAULT_ADDRESS env vars (or edit the top of this " +
        "file) with the addresses your deploy already printed, then run this again.",
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);

  const pivahToken = await ethers.getContractAt("PivahToken", PIVAH_TOKEN);
  const stakingVault = await ethers.getContractAt("PivahNftStakingVault", STAKING_VAULT);

  const seedBudget = ethers.parseEther("1000000"); // 1,000,000 PIVAH
  console.log("Approving...");
  await (await pivahToken.approve(STAKING_VAULT, seedBudget)).wait();
  console.log("Funding vault...");
  await (await stakingVault.fund(seedBudget)).wait();
  console.log("Setting emission rate...");
  await (await stakingVault.setRewardRate(ethers.parseEther("1"))).wait(); // 1 PIVAH/sec

  console.log("\nDone — staking vault seeded with 1,000,000 PIVAH at 1 PIVAH/sec emission.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
