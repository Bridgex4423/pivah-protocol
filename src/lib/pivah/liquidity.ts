/**
 * LP share math — TypeScript mirror of PivahCollectionPool's liquidity
 * accounting. Advisory only; the contract is authoritative at execution.
 *
 *   poolValue = quoteReserves + inventory * spotPrice
 *   sharesOut = valueAdded * totalSupply / poolValueBefore
 *
 * Fees accrue into quoteReserves, so shares appreciate instead of being
 * claimed separately.
 */

import { WAD } from "./curve";

export interface LiquidityState {
  spotPrice: bigint;
  inventory: number;
  quoteReserves: bigint;
  totalShares: bigint;
  /** Shares held by the connected wallet. */
  userShares: bigint;
}

export const MIN_LIQUIDITY = 1000n;

export function poolValue(s: Pick<LiquidityState, "spotPrice" | "inventory" | "quoteReserves">) {
  return s.quoteReserves + BigInt(s.inventory) * s.spotPrice;
}

export interface AddQuote {
  valueAdded: bigint;
  sharesOut: bigint;
  /** Resulting ownership of the pool, in basis points. */
  poolShareBps: bigint;
  error?: string | undefined;
}

export function quoteAddLiquidity(
  state: LiquidityState,
  nftCount: number,
  quoteAmount: bigint,
): AddQuote {
  if (nftCount <= 0 && quoteAmount <= 0n)
    return { valueAdded: 0n, sharesOut: 0n, poolShareBps: 0n, error: "Enter an amount" };

  const valueAdded = quoteAmount + BigInt(nftCount) * state.spotPrice;
  const before = poolValue(state);

  let sharesOut: bigint;
  if (state.totalShares === 0n) {
    sharesOut = valueAdded > MIN_LIQUIDITY ? valueAdded - MIN_LIQUIDITY : 0n;
  } else {
    sharesOut = (valueAdded * state.totalShares) / before;
  }

  if (sharesOut === 0n)
    return { valueAdded, sharesOut: 0n, poolShareBps: 0n, error: "Deposit too small" };

  const newTotal = state.totalShares + sharesOut + (state.totalShares === 0n ? MIN_LIQUIDITY : 0n);
  return {
    valueAdded,
    sharesOut,
    poolShareBps: (sharesOut * 10_000n) / newTotal,
  };
}

export interface RemoveQuote {
  nftsOut: number;
  quoteOut: bigint;
  valueOut: bigint;
  error?: string | undefined;
}

export function quoteRemoveLiquidity(state: LiquidityState, shares: bigint): RemoveQuote {
  if (shares <= 0n) return { nftsOut: 0, quoteOut: 0n, valueOut: 0n, error: "Enter an amount" };
  if (shares > state.userShares)
    return { nftsOut: 0, quoteOut: 0n, valueOut: 0n, error: "Exceeds your LP balance" };
  if (state.totalShares === 0n)
    return { nftsOut: 0, quoteOut: 0n, valueOut: 0n, error: "Pool is empty" };

  const nftsOut = Number((BigInt(state.inventory) * shares) / state.totalShares);
  const quoteOut = (state.quoteReserves * shares) / state.totalShares;

  if (nftsOut === 0 && quoteOut === 0n)
    return { nftsOut: 0, quoteOut: 0n, valueOut: 0n, error: "Withdrawal rounds to zero" };

  return {
    nftsOut,
    quoteOut,
    valueOut: quoteOut + BigInt(nftsOut) * state.spotPrice,
  };
}

/** Quote-token value of a single LP share, WAD-scaled. */
export function sharePrice(state: LiquidityState) {
  if (state.totalShares === 0n) return 0n;
  return (poolValue(state) * WAD) / state.totalShares;
}
