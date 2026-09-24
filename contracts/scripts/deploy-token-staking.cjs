// Deploys ONLY the PIVAH token and staking vault — it never touches the
// five core protocol contracts (FeeManager, PoolFactory, Router,
// Marketplace, CollectionFactory), which are already live and verified.
// Running deploy.cjs again for this would redeploy all five of those too,
// wastefully and confusingly — this script exists specifically to avoid
// that.
const hre = require("hardhat");
const { ethers } = hre;

const MAINNET_CHAIN_ID = 8453;
const LOCAL_CHAIN_ID = 31337;
const DEFAULT_TESTNET_TREASURY = "0x0Ff55F04C8297e19039aA1D0aefa1f831502E603";

async function verifyContract(label, address, constructorArguments) {
  try {
    await hre.run("verify:verify", { address, constructorArguments });
    console.log(`  ✓ ${label} verified`);
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.toLowerCase().includes("already verified")) {
      console.log(`  ✓ ${label} already verified`);
    } else {
      console.warn(`  ✗ ${label} verification failed: ${msg}`);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const treasury = process.env.TREASURY_ADDRESS || DEFAULT_TESTNET_TREASURY;
  if (chainId === MAINNET_CHAIN_ID && !process.env.TREASURY_ADDRESS) {
    throw new Error(
      "Refusing to deploy PIVAH on Base mainnet without TREASURY_ADDRESS set explicitly in .env — " +
        "the full supply mints straight to this address, so it must be deliberate, not a fallback.",
    );
  }

  console.log(
    chainId === MAINNET_CHAIN_ID
      ? "*** DEPLOYING TO BASE MAINNET ***"
      : "Deploying to a non-mainnet network",
  );
  console.log("Deployer:", deployer.address);
  console.log("Treasury (full PIVAH supply mints here):", treasury);

  const pivahToken = await (await ethers.getContractFactory("PivahToken")).deploy(treasury);
  await pivahToken.waitForDeployment();
  const pivahTokenAddress = await pivahToken.getAddress();

  const stakingVault = await (
    await ethers.getContractFactory("PivahNftStakingVault")
  ).deploy(pivahTokenAddress, deployer.address);
  await stakingVault.waitForDeployment();
  const stakingVaultAddress = await stakingVault.getAddress();

  console.log("\nPaste these into src/lib/pivah/addresses.ts under pivahToken / stakingVault:\n");
  console.log(
    JSON.stringify({ pivahToken: pivahTokenAddress, stakingVault: stakingVaultAddress }, null, 2),
  );

  // Verification is opt-in and OFF by default here — a verified contract's
  // full source becomes readable on the block explorer immediately,
  // clearly labeled "PivahToken". Skipping it keeps the contract's purpose
  // less obvious at a glance without pretending the address itself isn't
  // public (it always is, on a public chain) — verify later, whenever
  // that's the right call, with:
  //   VERIFY_TOKEN_STAKING=true npx hardhat run scripts/deploy-token-staking.cjs --network base
  // (safe to re-run — it only ever verifies these two addresses, it does
  // not redeploy anything, so running it again costs nothing extra.)
  if (
    chainId !== LOCAL_CHAIN_ID &&
    process.env.BASESCAN_API_KEY &&
    process.env.VERIFY_TOKEN_STAKING === "true"
  ) {
    console.log("\nWaiting for the block explorer to index these contracts before verifying...");
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    await verifyContract("PivahToken", pivahTokenAddress, [treasury]);
    await verifyContract("PivahNftStakingVault", stakingVaultAddress, [
      pivahTokenAddress,
      deployer.address,
    ]);
  } else {
    console.log(
      '\nSkipping verification — VERIFY_TOKEN_STAKING not set to "true". The contracts are live ' +
        "and fully usable either way; only their source code readability on the block explorer is affected.",
    );
  }

  console.log(
    "\nStaking vault deployed with zero reward budget and a zero emission rate — this is " +
      "deliberate. Staking and reward accrual both work correctly right now regardless; only " +
      "claim() needs the vault actually funded, whenever that's the right call.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
