/**
 * Pivah bonding-curve math — TypeScript mirror of PivahCollectionPool.
 *
 * IMPORTANT: this mirror exists so the UI can render quotes instantly.
 * It is NOT authoritative. Before any transaction the frontend must call the
 * on-chain `quoteBuy` / `quoteSell` view functions; the contract is the only
 * source of truth for execution pricing.
 *
 * All amounts are bigint wei. Prices step per NFT traded (discrete curve),
 * never a constant-product AMM — NFTs are not fungible units of a reserve.
 */

export type CurveType = "linear" | "exponential";

/** 1e18 fixed point. */
export const WAD = 10n ** 18n;
/** Fee basis points denominator. */
export const BPS = 10_000n;

export interface PoolState {
  curve: CurveType;
  /** Current spot price in quote-token wei (price of the NEXT buy). */
  spotPrice: bigint;
  /** Linear: absolute wei step. Exponential: WAD-scaled multiplier (1.05e18). */
  delta: bigint;
  /** NFT token ids held by the pool. */
  inventory: number;
  /** Quote-token (WETH) liquidity held by the pool, in wei. */
  quoteLiquidity: bigint;
  /** Fee paid to liquidity providers, basis points. */
  lpFeeBps: bigint;
  /** Fee paid to the protocol fee manager, basis points. */
  protocolFeeBps: bigint;
}

export interface Quote {
  /** Number of NFTs in the trade. */
  count: number;
  /** Base amount before fees, wei. */
  subtotal: bigint;
  lpFee: bigint;
  protocolFee: bigint;
  /** What the trader pays (buy) or receives (sell), wei. */
  total: bigint;
  spotPriceBefore: bigint;
  spotPriceAfter: bigint;
  /** Price impact in basis points. */
  priceImpactBps: bigint;
  error?: string | undefined;
}

function mulWad(a: bigint, b: bigint) {
  return (a * b) / WAD;
}

function divWad(a: bigint, b: bigint) {
  return (a * WAD) / b;
}

/**
 * BUY: the pool sells NFTs out of inventory. Price steps UP after each unit.
 *
 * Linear:      price_i = spot + i * delta          (i = 0..n-1)
 * Exponential: price_i = spot * (delta/WAD)^i
 *
 * Note the pool quotes the *current* spot for the first unit, then advances.
 */
export function quoteBuy(pool: PoolState, count: number): Quote {
  const before = pool.spotPrice;
  if (count <= 0) return emptyQuote(before, "Enter an amount");
  if (count > pool.inventory) return emptyQuote(before, `Pool only holds ${pool.inventory} NFT(s)`);

  let price = pool.spotPrice;
  let subtotal = 0n;
  for (let i = 0; i < count; i++) {
    subtotal += price;
    price = nextUp(pool.curve, price, pool.delta);
  }

  const lpFee = (subtotal * pool.lpFeeBps) / BPS;
  const protocolFee = (subtotal * pool.protocolFeeBps) / BPS;

  return {
    count,
    subtotal,
    lpFee,
    protocolFee,
    total: subtotal + lpFee + protocolFee,
    spotPriceBefore: before,
    spotPriceAfter: price,
    priceImpactBps: impact(before, price),
  };
}

/**
 * SELL: the pool buys NFTs into inventory. Price steps DOWN after each unit.
 * The first unit sells at one step below spot, matching the buy/sell spread.
 */
export function quoteSell(pool: PoolState, count: number): Quote {
  const before = pool.spotPrice;
  if (count <= 0) return emptyQuote(before, "Enter an amount");

  let price = nextDown(pool.curve, pool.spotPrice, pool.delta);
  let subtotal = 0n;
  for (let i = 0; i < count; i++) {
    if (price <= 0n) return emptyQuote(before, "Curve floor reached");
    subtotal += price;
    price = nextDown(pool.curve, price, pool.delta);
  }

  const lpFee = (subtotal * pool.lpFeeBps) / BPS;
  const protocolFee = (subtotal * pool.protocolFeeBps) / BPS;
  const total = subtotal - lpFee - protocolFee;

  if (total > pool.quoteLiquidity)
    return emptyQuote(before, "Pool does not hold enough WETH to buy this many NFTs");

  return {
    count,
    subtotal,
    lpFee,
    protocolFee,
    total,
    spotPriceBefore: before,
    spotPriceAfter: nextUp(pool.curve, price, pool.delta),
    priceImpactBps: impact(before, price),
  };
}

function nextUp(curve: CurveType, price: bigint, delta: bigint) {
  return curve === "linear" ? price + delta : mulWad(price, delta);
}

function nextDown(curve: CurveType, price: bigint, delta: bigint) {
  if (curve === "linear") return price > delta ? price - delta : 0n;
  return divWad(price * WAD, delta) / WAD;
}

function impact(before: bigint, after: bigint) {
  if (before === 0n) return 0n;
  const diff = after > before ? after - before : before - after;
  return (diff * BPS) / before;
}

function emptyQuote(spot: bigint, error?: string): Quote {
  return {
    count: 0,
    subtotal: 0n,
    lpFee: 0n,
    protocolFee: 0n,
    total: 0n,
    spotPriceBefore: spot,
    spotPriceAfter: spot,
    priceImpactBps: 0n,
    error,
  };
}

/** Apply user slippage tolerance to a quote total. */
export function withSlippage(total: bigint, slippageBps: bigint, direction: "max" | "min") {
  return direction === "max"
    ? (total * (BPS + slippageBps)) / BPS
    : (total * (BPS - slippageBps)) / BPS;
}

/** Format wei as a human ETH/WETH string. */
export function formatEth(wei: bigint, decimals = 4) {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const whole = abs / WAD;
  const frac = ((abs % WAD) * 10n ** BigInt(decimals)) / WAD;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fracStr ? `.${fracStr}` : ""}`;
}

export function parseEth(value: string): bigint {
  const [whole = "0", frac = ""] = value.split(".");
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * WAD + BigInt(padded || "0");
}
