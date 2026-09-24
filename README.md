# Pivah Protocol

A full-stack Web3 app for NFT liquidity, creator studios, and financial infrastructure on **Base**.

- **Frontend:** TanStack Start + React 19 + Tailwind CSS v4 + wagmi/viem + RainbowKit
- **Contracts:** Hardhat + Solidity 0.8.24 + OpenZeppelin
- **Target chains:** Base mainnet and Base Sepolia

---

## What you can do locally

1. Run the web app on `http://localhost:8080`
2. Compile and test the Solidity contracts with Hardhat
3. Deploy the contracts to Base Sepolia (or Base mainnet)
4. Paste the deployed addresses into the frontend config

---

## Prerequisites

- **Node.js** 18+ (Node 20 recommended). Install with [nvm](https://github.com/nvm-sh/nvm#installing-and-updating).
- **npm** or **bun** (bun is faster; npm works everywhere).
- A **GitHub repo** or local clone of this project.
- A wallet with **Base Sepolia ETH** for testnet deploys (e.g. from the [Base Sepolia faucet](https://www.alchemy.com/faucets/base-sepolia)).
- (Optional) A **WalletConnect Project ID** if you want the wallet modal to work without an allowlist error. Get one free at [cloud.reown.com](https://cloud.reown.com).

---

## Quick start

```bash
# 1. Clone the project
git clone <this-repository-url>
cd <repository-name>

# 2. Install frontend dependencies
npm install
# or: bun install

# 3. Start the dev server
npm run dev
# or: bun dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## Running the frontend

The frontend is a TanStack Start app served by Vite.

```bash
# In the project root
npm install
npm run dev
```

Other useful commands:

```bash
npm run build          # Production build
npm run build:dev      # Development build
npm run preview        # Preview the production build locally
npm run lint           # Run ESLint
npm run format         # Run Prettier
```

### Environment variables for the frontend

Create a `.env` file in the project root if you need WalletConnect:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_from_reown_cloud
```

- If you do not set this, the app falls back to a placeholder project ID.
- The placeholder may show an **"Origin not found on Allowlist"** error in RainbowKit. Add `localhost:8080` and your Lovable preview/published URL to your Reown Cloud project's allowlist to fix it.

No other secrets are needed to run the frontend locally in read-only/demo mode.

---

## Running the Hardhat contracts

The contract suite lives in `contracts/` and is a separate npm package.

```bash
# 1. Move into the contracts folder
cd contracts

# 2. Install contract dependencies
npm install

# 3. Compile the contracts
npx hardhat compile

# 4. Run the tests
npx hardhat test
```

### Hardhat scripts available

```bash
npx hardhat compile                  # Compile all contracts
npx hardhat test                     # Run the test suite
npx hardhat run scripts/deploy.cjs --network baseSepolia   # Deploy to Base Sepolia
npx hardhat run scripts/deploy.cjs --network base          # Deploy to Base mainnet
```

### Environment variables for Hardhat

Create a `.env` file inside `contracts/` (or export variables in your shell):

```env
# Required for deploying to Base Sepolia
DEPLOYER_PRIVATE_KEY=0x...your_burner_private_key...with_base_sepolia_eth...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Required for deploying to Base mainnet
BASE_RPC_URL=https://mainnet.base.org

# Optional: for contract verification on Basescan
BASESCAN_API_KEY=your_basescan_api_key
```

**Security notes:**
- Use a **burner/deployer key** with only testnet ETH. Never use your main wallet.
- Keep `.env` out of git. The project already has `.gitignore` rules for `.env` files.
- Do not commit private keys.

---

## Deploying to Base Sepolia

After your contracts compile and tests pass, deploy them in one command:

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

Copy those addresses into `src/lib/pivah/addresses.ts` under the `84532` (Base Sepolia) entry. Then the frontend will switch from demo mode to live on-chain reads and writes.

### Deploying with Remix instead of Hardhat

You can paste the contracts into [Remix](https://remix.ethereum.org/), but you must match the Hardhat settings:

- Solidity compiler: **0.8.24**
- **Optimizer enabled**, **200 runs**
- **viaIR enabled**
- Deploy via **Injected Provider — MetaMask** on Base Sepolia
- Deploy in the same order and with the same constructor arguments as `contracts/scripts/deploy.cjs`

Hardhat is strongly recommended because it runs the exact same configuration as the tests.

---

## Project structure

```text
.
├── src/                         # Frontend source
│   ├── components/              # UI components and layout
│   ├── lib/                     # Utilities, protocol math, wagmi config
│   │   └── pivah/               # Pivah-specific: ABIs, addresses, curve math, liquidity
│   ├── routes/                  # TanStack Start file-based routes
│   ├── router.tsx               # Router setup
│   ├── start.ts                 # TanStack Start server entry
│   └── styles.css               # Tailwind v4 theme and global styles
├── contracts/                   # Solidity contract suite
│   ├── src/                     # Contract source files
│   ├── test/                    # Hardhat tests
│   ├── scripts/                 # Deployment scripts
│   ├── hardhat.config.cjs       # Hardhat config
│   └── package.json             # Contract dependencies
├── README.md                    # This file
└── package.json                 # Frontend dependencies
```

---

## Common issues

| Problem | Fix |
| --- | --- |
| `npm install` fails on M1/M2 Mac | Make sure Node 18+ is active: `nvm use 20` |
| `Origin not found on Allowlist` in wallet modal | Add `localhost:8080` and your Lovable preview URL to your WalletConnect/Reown project allowlist |
| `VITE_WALLETCONNECT_PROJECT_ID` is missing | Add it to `.env` in the project root |
| Tests fail with `Insufficient funds` | You are running against a live network; use `--network hardhat` (default) for local tests |
| `Error: cannot find module 'hardhat'` | Run `npm install` from inside `contracts/` |
| `DeclarationError: Function "mcopy" not found` | The compiler needs the Cancun EVM target. `hardhat.config.cjs` sets `evmVersion: "cancun"`; pull the latest code, then run `npx hardhat clean` and `npx hardhat compile` |

---

## Status

This project is **unaudited** and intended for **testnet use only**. Do not deploy or use the contracts with real funds until a third-party security audit is complete.

---

## Built with

- [TanStack Start](https://tanstack.com/start)
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [wagmi](https://wagmi.sh) + [viem](https://viem.sh)
- [RainbowKit](https://rainbowkit.com)
- [Hardhat](https://hardhat.org)
