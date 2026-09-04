# Pivah Protocol — Contracts

Solidity suite for Pivah: NFT collection deployment, bonding-curve liquidity
pools, routing, marketplace and fee staking. Target chain: **Base** (Base
Sepolia for testing).

## Contracts

| Contract | Role |
| --- | --- |
| `PivahCurves` | Discrete bonding-curve math (linear + exponential). Mirrored in `src/lib/pivah/curve.ts`. |
| `PivahCollectionPool` | Two-sided NFT/quote pool. **Is itself the ERC20 LP token** — add/remove liquidity like a PancakeSwap pair. |
| `PivahPoolFactory` | Deploys pools, whitelists quote tokens, indexes pools per collection. |
| `PivahRouter` | ETH wrapping, and atomic NFT→NFT swaps across two pools. |
| `PivahMarketplace` | Escrow-free P2P listings and offers with ERC-2981 royalties. |
| `PivahCollection` / `PivahCollectionFactory` | Creator Studio ERC-721 with public mint, wallet cap, royalties. |
| `PivahFeeManager` | Protocol fee sink; splits between treasury and stakers. |
| `PivahStakingVault` | Stake protocol token, earn fee share (O(1) accumulator accounting). |

## Liquidity model (how the DEX works)

Pool value is measured in quote tokens:

```text
poolValue = quoteReserves + inventory * spotPrice
```

* **Add liquidity** — deposit NFTs and/or quote tokens. Shares minted =
  `valueAdded * totalSupply / poolValueBefore`. Adding liquidity deepens the
  pool but does **not** move the spot price.
* **Remove liquidity** — burn shares, receive a pro-rata slice of *both* sides.
* **Fees** — LP fees stay inside `quoteReserves`, so every share appreciates.
  There is no separate claim step. Protocol fees go to `PivahFeeManager`.
* **Pricing** — discrete steps, one per NFT. Buys step the price up, sells step
  it down. Never constant-product: NFTs are not fungible reserve units.

## Running locally

All commands are run from inside the `contracts/` directory.

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### Available scripts

```bash
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.cjs --network baseSepolia
npx hardhat run scripts/deploy.cjs --network base
```

## Environment variables

Create a `.env` file in `contracts/` or export the variables in your terminal.

```env
# Required for testnet deployment
DEPLOYER_PRIVATE_KEY=0x...your_burner_private_key...with_base_sepolia_eth...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Required for mainnet deployment
BASE_RPC_URL=https://mainnet.base.org

# Optional: for Basescan contract verification
BASESCAN_API_KEY=your_basescan_api_key
```

**Security notes:**
- Use a **burner key** with only testnet funds.
- Never commit `.env` or private keys.
- `DEPLOYER_PRIVATE_KEY` is the only secret required for deployment.

## Deploy to Base Sepolia

```bash
cd contracts
export DEPLOYER_PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
npx hardhat run scripts/deploy.cjs --network baseSepolia
```

The deploy script prints a JSON object like this:

```json
{
  "chainId": 84532,
  "weth": "0x4200000000000000000000000000000000000006",
  "feeManager": "0x...",
  "poolFactory": "0x...",
  "router": "0x...",
  "marketplace": "0x...",
  "collectionFactory": "0x...",
  "stakingVault": ""
}
```

Copy those addresses into `src/lib/pivah/addresses.ts` under the `84532` entry so the frontend can read from the live contracts.

## Deploy to Base mainnet

Only after the contracts have been audited and you are ready for production:

```bash
cd contracts
export DEPLOYER_PRIVATE_KEY=0x...
export BASE_RPC_URL=https://mainnet.base.org
npx hardhat run scripts/deploy.cjs --network base
```

## Status

Unaudited. Testnet only. Do not use with real funds until a third-party audit
is complete.
