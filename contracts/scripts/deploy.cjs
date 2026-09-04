const hre = require("hardhat");
const { ethers } = hre;

// Base Sepolia canonical WETH.
const WETH = {
  84532: "0x4200000000000000000000000000000000000006",
  8453: "0x4200000000000000000000000000000000000006",
};

// Where protocol fees (DEX trades, marketplace sales) actually land.
// Falls back to the testnet treasury below only on Base Sepolia — mainnet
// (chain 8453) requires TREASURY_ADDRESS to be set explicitly in
// contracts/.env and refuses to deploy without it, so a real mainnet
// deployment can never silently send real fees to a testnet-only wallet.
const DEFAULT_TESTNET_TREASURY = "0x0Ff55F04C8297e19039aA1D0aefa1f831502E603";
const MAINNET_CHAIN_ID = 8453;
const LOCAL_CHAIN_ID = 31337;

/** Verifies one contract's source on the block explorer, tolerating
 *  "already verified" and reporting (not throwing on) any other failure —
 *  a flaky explorer indexing delay should never be mistaken for the
 *  contract itself being broken. */
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
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const weth = WETH[chainId];
  if (!weth) throw new Error(`No WETH address configured for chain ${chainId}`);

  const isMainnet = chainId === MAINNET_CHAIN_ID;
  if (isMainnet && !process.env.TREASURY_ADDRESS) {
    throw new Error(
      "Deploying to Base mainnet requires TREASURY_ADDRESS set in contracts/.env — " +
        "refusing to fall back to the testnet treasury for a real deployment.",
    );
  }
  const treasury = process.env.TREASURY_ADDRESS || DEFAULT_TESTNET_TREASURY;
  if (!ethers.isAddress(treasury)) {
    throw new Error(`TREASURY_ADDRESS "${treasury}" is not a valid address`);
  }

  console.log(
    isMainnet ? "*** DEPLOYING TO BASE MAINNET ***" : "Deploying to Base Sepolia (testnet)",
  );
  console.log("Deployer:", deployer.address);
  console.log(
    "Treasury:",
    treasury,
    process.env.TREASURY_ADDRESS ? "(from .env)" : "(default testnet treasury)",
  );

  const feeManager = await (
    await ethers.getContractFactory("PivahFeeManager")
  ).deploy(
    deployer.address,
    treasury,
    50, // 0.5% protocol fee
  );
  await feeManager.waitForDeployment();

  const poolFactory = await (
    await ethers.getContractFactory("PivahPoolFactory")
  ).deploy(deployer.address, await feeManager.getAddress());
  await poolFactory.waitForDeployment();
  await (await poolFactory.setQuoteToken(weth, true)).wait();

  const router = await (await ethers.getContractFactory("PivahRouter")).deploy(weth);
  await router.waitForDeployment();

  const marketplace = await (
    await ethers.getContractFactory("PivahMarketplace")
  ).deploy(await feeManager.getAddress());
  await marketplace.waitForDeployment();

  const collectionFactory = await (
    await ethers.getContractFactory("PivahCollectionFactory")
  ).deploy();
  await collectionFactory.waitForDeployment();

  const addresses = {
    chainId,
    weth,
    feeManager: await feeManager.getAddress(),
    poolFactory: await poolFactory.getAddress(),
    router: await router.getAddress(),
    marketplace: await marketplace.getAddress(),
    collectionFactory: await collectionFactory.getAddress(),
    pivahToken: "",
    stakingVault: "",
  };

  // PIVAH and its staking vault are deployed by a dedicated script —
  // scripts/deploy-token-staking.cjs — never from here. This script
  // unconditionally deploys the five core contracts above every time it
  // runs; a token/staking branch here would risk redeploying all five of
  // those as expensive, confusing duplicates the moment someone re-ran it
  // just to add PIVAH later. Keeping deployment paths separate makes that
  // mistake structurally impossible instead of relying on remembering not
  // to set a flag.
  console.log(
    "\nCore protocol deployed. PIVAH token + staking vault are a separate step — see " +
      "scripts/deploy-token-staking.cjs, which never touches the contracts above.",
  );

  console.log("\nPaste these into src/lib/pivah/addresses.ts:\n");
  console.log(JSON.stringify(addresses, null, 2));

  // Verify every deployed contract's source on the block explorer, so
  // anyone — an auditor, a user, anyone — can read the real code behind
  // these addresses instead of trusting an unverified bytecode blob.
  if (chainId === LOCAL_CHAIN_ID) {
    // No real explorer for the local network — nothing to verify.
  } else if (!process.env.BASESCAN_API_KEY) {
    console.log(
      "\nBASESCAN_API_KEY not set — skipping automatic verification. Set it in .env and " +
        "re-run this script (redeploys nothing new, just adds verification), or verify " +
        "manually with `npx hardhat verify`.",
    );
  } else {
    console.log("\nWaiting for the block explorer to index these contracts before verifying...");
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    console.log("Verifying contracts:");
    await verifyContract("PivahFeeManager", addresses.feeManager, [deployer.address, treasury, 50]);
    await verifyContract("PivahPoolFactory", addresses.poolFactory, [
      deployer.address,
      addresses.feeManager,
    ]);
    await verifyContract("PivahRouter", addresses.router, [weth]);
    await verifyContract("PivahMarketplace", addresses.marketplace, [addresses.feeManager]);
    await verifyContract("PivahCollectionFactory", addresses.collectionFactory, []);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
