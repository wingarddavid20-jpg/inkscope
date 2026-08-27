import { ethers } from 'ethers';
import tydroAddresses from '@/data/tydro-addresses.json';

// ─────────────────────────────────────────────────────────────────────────────
// Tydro service — real on-chain data for Tydro (Aave V3 white-label on Ink).
//
// All reads go through an ethers.JsonRpcProvider backed by the Alchemy RPC
// endpoint from NEXT_PUBLIC_ALCHEMY_API_KEY (falls back to the public Ink RPC).
// Contract addresses live in data/tydro-addresses.json and were verified
// against the live chain (PoolAddressesProvider.getPool / getPoolDataProvider /
// getPriceOracle all match on 2026-08-25).
// ─────────────────────────────────────────────────────────────────────────────

const RAY = 1e27;
const BASE_CURRENCY_DECIMALS = 8; // Aave oracle / user account data precision

// ── ABIs (minimal fragments, ethers v6) ──────────────────────────────────────

const erc20Abi = ['function symbol() view returns (string)'];

const poolAbi = [
  'function getReservesList() view returns (address[])',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint256 stableRateLastUpdated, bool usageAsCollateralEnabled)',
];

const poolDataProviderAbi = [
  'function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)',
  'function getReserveData(address asset) view returns (uint256 unbackedTokens, uint256 accruedToTreasury, uint256 totalATokenSupply, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint256 lastUpdateTimestamp)',
];

const oracleAbi = ['function getAssetPrice(address asset) view returns (uint256)'];

// ── Types ────────────────────────────────────────────────────────────────────

export type TydroReserve = {
  address: string;
  symbol: string;
  decimals: number;
  /** Total supplied (aToken supply) in token units. */
  supplied: number;
  /** Total outstanding debt (variable + stable) in token units. */
  borrowed: number;
  /** Available liquidity in token units. */
  available: number;
  /** Utilization ratio, 0–100. */
  utilization: number;
  /** Current supply APY, percent. */
  supplyApy: number;
  /** Current variable borrow APY, percent. */
  borrowApy: number;
  /** Oracle price in USD. */
  priceUsd: number;
  suppliedUsd: number;
  borrowedUsd: number;
};

export type TydroOverview = {
  /** Total supplied across all reserves, USD. */
  tvlUsd: number;
  /** Total outstanding debt across all reserves, USD. */
  totalBorrowUsd: number;
  /** Total available liquidity, USD. */
  availableUsd: number;
  /** Weighted protocol utilization, 0–100. */
  utilization: number;
  reserves: TydroReserve[];
  updatedAt: number;
};

export type TydroAssetRef = {
  address: string;
  symbol: string;
  decimals: number;
  priceUsd: number;
};

export type TydroUserSupply = {
  asset: TydroAssetRef;
  amount: number;
  amountUsd: number;
};

export type TydroUserBorrow = {
  asset: TydroAssetRef;
  amount: number;
  amountUsd: number;
};

export type TydroUserPosition = {
  address: string;
  /** Health factor (capped at 999 for display; max uint256 = "no debt"). */
  healthFactor: number;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  availableBorrowsUsd: number;
  /** Current liquidation threshold, percent. */
  liquidationThresholdPct: number;
  /** LTV, percent. */
  ltvPct: number;
  supplies: TydroUserSupply[];
  borrows: TydroUserBorrow[];
};

// ── Provider / contract accessors (client-only) ──────────────────────────────

let providerCache: ethers.JsonRpcProvider | null = null;

export function getTydroProvider(): ethers.JsonRpcProvider {
  if (providerCache) return providerCache;

  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const url = apiKey
    ? `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`
    : tydroAddresses.rpcFallback;

  providerCache = new ethers.JsonRpcProvider(url, tydroAddresses.chainId, {
    staticNetwork: true,
  });
  return providerCache;
}

export function getTydroPool(provider: ethers.Provider = getTydroProvider()) {
  return new ethers.Contract(tydroAddresses.pool, poolAbi, provider);
}

export function getTydroDataProvider(provider: ethers.Provider = getTydroProvider()) {
  return new ethers.Contract(tydroAddresses.poolDataProvider, poolDataProviderAbi, provider);
}

export function getTydroOracle(provider: ethers.Provider = getTydroProvider()) {
  return new ethers.Contract(tydroAddresses.oracle, oracleAbi, provider);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Chunked Promise.all to stay gentle on the RPC endpoint. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// NOTE: BigInt() calls instead of literals — the project tsconfig targets es5.
const MAX_UINT256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');

export function formatHealthFactor(raw: bigint): number {
  if (raw >= MAX_UINT256 - BigInt(1)) return Number.POSITIVE_INFINITY;
  return Number(raw) / 1e18;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const short = (err as any).shortMessage as string | undefined;
    return short ?? err.message;
  }
  return 'Unknown error';
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches the live reserve list from the pool, falling back to the verified
 * snapshot in data/tydro-addresses.json.
 */
export async function getTydroReserveList(provider: ethers.Provider = getTydroProvider()): Promise<string[]> {
  try {
    const pool = getTydroPool(provider);
    const list = await pool.getReservesList();
    if (Array.isArray(list) && list.length > 0) return list.map((a: string) => a.toLowerCase());
  } catch (err) {
    console.warn('getReservesList failed, using snapshot:', errorMessage(err));
  }
  return tydroAddresses.reserves.map((a) => a.toLowerCase());
}

async function fetchReserveSymbol(provider: ethers.Provider, address: string): Promise<string> {
  try {
    const token = new ethers.Contract(address, erc20Abi, provider);
    const symbol = await token.symbol();
    if (typeof symbol === 'string' && symbol.trim()) return symbol.trim();
  } catch {
    // non-standard token — fall through to a short address label
  }
  return `${address.slice(0, 4)}…${address.slice(-3)}`.toUpperCase();
}

async function fetchReserveMetrics(
  provider: ethers.Provider,
  reserveAddress: string
): Promise<TydroReserve> {
  const pdp = getTydroDataProvider(provider);
  const oracle = getTydroOracle(provider);

  const [config, data, priceRaw, symbol] = await Promise.all([
    pdp.getReserveConfigurationData(reserveAddress),
    pdp.getReserveData(reserveAddress),
    oracle.getAssetPrice(reserveAddress),
    fetchReserveSymbol(provider, reserveAddress),
  ]);

  const decimals = Number(config.decimals);
  const supplied = Number(ethers.formatUnits(data.totalATokenSupply, decimals));
  const borrowed = Number(
    ethers.formatUnits(data.totalVariableDebt + data.totalStableDebt, decimals)
  );
  const available = Math.max(supplied - borrowed, 0);
  const priceUsd = Number(ethers.formatUnits(priceRaw, BASE_CURRENCY_DECIMALS));

  return {
    address: reserveAddress,
    symbol,
    decimals,
    supplied,
    borrowed,
    available,
    utilization: supplied > 0 ? (borrowed / supplied) * 100 : 0,
    supplyApy: (Number(data.liquidityRate) / RAY) * 100,
    borrowApy: (Number(data.variableBorrowRate) / RAY) * 100,
    priceUsd,
    suppliedUsd: supplied * priceUsd,
    borrowedUsd: borrowed * priceUsd,
  };
}

/** Fetches the full Tydro protocol overview (TVL, borrows, per-reserve data). */
export async function fetchTydroOverview(provider: ethers.Provider = getTydroProvider()): Promise<TydroOverview> {
  const reserves = await getTydroReserveList(provider);

  // One flaky reserve call shouldn't blank the whole panel — skip failures.
  const metrics: TydroReserve[] = [];
  let lastError: unknown = null;

  await mapWithConcurrency(reserves, 6, async (addr) => {
    try {
      metrics.push(await fetchReserveMetrics(provider, addr));
    } catch (err) {
      lastError = err;
      console.warn(`Tydro reserve ${addr} metrics failed, skipping:`, errorMessage(err));
    }
  });

  if (metrics.length === 0 && lastError) throw lastError;

  const sorted = metrics
    .sort((a, b) => b.suppliedUsd - a.suppliedUsd)
    .filter((r) => r.suppliedUsd > 0 || r.borrowedUsd > 0);

  const tvlUsd = sorted.reduce((sum, r) => sum + r.suppliedUsd, 0);
  const totalBorrowUsd = sorted.reduce((sum, r) => sum + r.borrowedUsd, 0);
  const availableUsd = sorted.reduce((sum, r) => sum + r.suppliedUsd - r.borrowedUsd, 0);

  return {
    tvlUsd,
    totalBorrowUsd,
    availableUsd,
    utilization: tvlUsd > 0 ? (totalBorrowUsd / tvlUsd) * 100 : 0,
    reserves: sorted,
    updatedAt: Date.now(),
  };
}

/**
 * Fetches a user's Tydro position (works for connected wallets AND pasted
 * read-only addresses). Returns null when the user has no active position.
 */
export async function fetchTydroUserPosition(
  address: string,
  provider: ethers.Provider = getTydroProvider()
): Promise<TydroUserPosition | null> {
  const pool = getTydroPool(provider);
  const pdp = getTydroDataProvider(provider);
  const oracle = getTydroOracle(provider);

  const [accountData, reserveAddresses] = await Promise.all([
    pool.getUserAccountData(address),
    getTydroReserveList(provider),
  ]);

  const totalCollateralUsd = Number(ethers.formatUnits(accountData.totalCollateralBase, BASE_CURRENCY_DECIMALS));
  const totalDebtUsd = Number(ethers.formatUnits(accountData.totalDebtBase, BASE_CURRENCY_DECIMALS));
  const availableBorrowsUsd = Number(ethers.formatUnits(accountData.availableBorrowsBase, BASE_CURRENCY_DECIMALS));
  const liquidationThresholdPct = Number(accountData.currentLiquidationThreshold) / 1e4;
  const ltvPct = Number(accountData.ltv) / 1e4;
  const healthFactor = formatHealthFactor(accountData.healthFactor);

  // No position at all (nothing supplied, nothing borrowed).
  if (totalCollateralUsd === 0 && totalDebtUsd === 0) return null;

  const rows = await mapWithConcurrency(reserveAddresses, 6, async (reserveAddress) => {
    const [userReserve, config, priceRaw, symbol] = await Promise.all([
      pool.getUserReserveData(reserveAddress, address),
      pdp.getReserveConfigurationData(reserveAddress),
      oracle.getAssetPrice(reserveAddress),
      fetchReserveSymbol(provider, reserveAddress),
    ]);
    return {
      asset: {
        address: reserveAddress,
        symbol,
        decimals: Number(config.decimals),
        priceUsd: Number(ethers.formatUnits(priceRaw, BASE_CURRENCY_DECIMALS)),
      } satisfies TydroAssetRef,
      userReserve,
    };
  });

  const supplies: TydroUserSupply[] = [];
  const borrows: TydroUserBorrow[] = [];

  for (const { asset, userReserve } of rows) {
    const suppliedAmount = Number(ethers.formatUnits(userReserve.currentATokenBalance, asset.decimals));
    const borrowedAmount = Number(
      ethers.formatUnits(userReserve.currentVariableDebt + userReserve.currentStableDebt, asset.decimals)
    );
    if (suppliedAmount > 0) {
      supplies.push({ asset, amount: suppliedAmount, amountUsd: suppliedAmount * asset.priceUsd });
    }
    if (borrowedAmount > 0) {
      borrows.push({ asset, amount: borrowedAmount, amountUsd: borrowedAmount * asset.priceUsd });
    }
  }

  supplies.sort((a, b) => b.amountUsd - a.amountUsd);
  borrows.sort((a, b) => b.amountUsd - a.amountUsd);

  return {
    address,
    healthFactor,
    totalCollateralUsd,
    totalDebtUsd,
    availableBorrowsUsd,
    liquidationThresholdPct,
    ltvPct,
    supplies,
    borrows,
  };
}

export { errorMessage as getTydroErrorMessage };
