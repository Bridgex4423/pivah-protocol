/**
 * Deployed Pivah contract addresses per chain.
 *
 * Fill these in after running `npx hardhat run scripts/deploy.cjs --network baseSepolia`
 * inside `contracts/`. Empty string means "not deployed yet" — the UI renders
 * read-only demo state until an address is present.
 */

export const BASE = 8453;
export const BASE_SEPOLIA = 84532;

export interface PivahAddresses {
  weth: `0x${string}`;
  feeManager: `0x${string}` | "";
  poolFactory: `0x${string}` | "";
  router: `0x${string}` | "";
  marketplace: `0x${string}` | "";
  collectionFactory: `0x${string}` | "";
  pivahToken: `0x${string}` | "";
  stakingVault: `0x${string}` | "";
}

export const addresses: Record<number, PivahAddresses> = {
  [BASE_SEPOLIA]: {
    weth: "0x4200000000000000000000000000000000000006",
    feeManager: "0x1295B8d7011F5A8037a4C07162d35e10dB607C32",
    poolFactory: "0x7300C6AB27a8B182CE143CBc1c42f57dF717090F",
    router: "0xe2CDeDCe44ce30bb5a9C677aAff4e2E5bA1C9E93",
    marketplace: "0xd30b571e4002f1F2c0112c3a58Eb0ef351dC665e",
    collectionFactory: "0x0b1cc15F36Ee69e198E266612e6950E4377b3762",
    // PIVAH and staking are deliberately deferred to TGE — see contracts/scripts/deploy.cjs.
    pivahToken: "",
    stakingVault: "",
  },
  [BASE]: {
    weth: "0x4200000000000000000000000000000000000006",
    feeManager: "0xe81DA2539Fc8d5442f2Df2aDa88c779696632f51",
    poolFactory: "0xE680A4FAd979319f2030E93B63110Ea0D3A93a4d",
    router: "0x5ef96830795f5FC79D6682581AC5B20d26839cD2",
    marketplace: "0xA7B13978db4c1c134B1B1075f1AFB460f55a9BD2",
    collectionFactory: "0x95C0D446ba161Fd5090e6080af9cDd0A0C276d3B",
    pivahToken: "0x1E51E386a83a8159dd2bB3deacafEb411ae7a1F3",
    stakingVault: "0x78abd48A219bCfc6446302d7a115048FB16E6Df6",
  },
};

export function getAddresses(chainId: number | undefined): PivahAddresses {
  return addresses[chainId ?? BASE_SEPOLIA] ?? addresses[BASE_SEPOLIA]!;
}

export function isDeployed(chainId: number | undefined) {
  return getAddresses(chainId).poolFactory !== "";
}
