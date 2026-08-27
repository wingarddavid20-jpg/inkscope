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

const erc20Abi = [
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
];

const poolAbi = [
  'function getReservesList() view returns (address[])',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint256 stableRateLastUpdated, bool usageAsCollateralEnabled)',
  // CUSTOM Tydro layout (15 words, verified by raw eth_call decode 2026-08-26):
  // stock Aave V3 order but with `id` (uint8) moved before the token addresses
  // and 3 extra trailing uint256 words. Words: 0 configuration, 1 liquidityIndex,
  // 2 currentLiquidityRate, 3 variableBorrowIndex, 4 currentVariableBorrowRate,
  // 5 currentStableBorrowRate, 6 lastUpdateTimestamp, 7 id, 8 aTokenAddress,
  // 9 stableDebtTokenAddress, 10 variableDebtTokenAddress,
  // 11 interestRateStrategyAddress, 12-14 extra.
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint8 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 extra1, uint256 extra2, uint256 extra3)',
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

/**
 * Categorizes a Tydro position's health factor into an hl.eco-style risk
 * band. Health factor of Infinity (no debt) is always Conservative.
 */
export const getRiskLevel = (healthFactor: number): {
  label: 'Conservative' | 'Balanced' | 'Aggressive' | 'At Risk';
  color: 'green' | 'yellow' | 'orange' | 'red';
  description: string;
} => {
  if (healthFactor > 3) {
    return {
      label: 'Conservative',
      color: 'green',
      description: 'Low risk — liquidation unlikely'
    };
  }
  if (healthFactor > 1.5) {
    return {
      label: 'Balanced',
      color: 'yellow',
      description: 'Moderate risk — monitor your position'
    };
  }
  if (healthFactor > 1.1) {
    return {
      label: 'Aggressive',
      color: 'orange',
      description: 'High risk — close to liquidation threshold'
    };
  }
  return {
    label: 'At Risk',
    color: 'red',
    description: 'Critical — immediate action recommended'
  };
};

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

type RawReserveBalances = { suppliedRaw: bigint; borrowedRaw: bigint };

/**
 * Reads a token balance, tolerating quirks: the zero address (some reserves
 * have no deployed stable debt token — getReserveData returns 0x0 there, and
 * calling address(0) returns empty data which ethers refuses to decode as
 * uint256) counts as 0; any other single-token read failure is logged and
 * also counts as 0 so one broken token can't abort the whole reserve.
 */
async function fetchTokenBalance(
  provider: ethers.Provider,
  tokenAddress: string,
  userAddress: string
): Promise<bigint> {
  if (!tokenAddress || /^0x0+$/i.test(tokenAddress)) return BigInt(0);
  try {
    return await new ethers.Contract(tokenAddress, erc20Abi, provider).balanceOf(userAddress);
  } catch (err) {
    console.warn(`balanceOf failed for ${tokenAddress}, treating as 0:`, errorMessage(err));
    return BigInt(0);
  }
}

/**
 * Reads one reserve's balances for a user. `Pool.getUserReserveData` is the
 * primary read, but it REVERTS for some real positions (verified on chain:
 * the Tydro pool returns zeros from getUserAccountData and reverts on
 * getUserReserveData for accounts holding aToken balances). Every reserve
 * therefore degrades to aToken / debt-token `balanceOf` reads instead of
 * blanking the whole position. Returns null only when both reads fail —
 * that reserve is skipped, never fatal.
 */
async function fetchReserveBalances(
  provider: ethers.Provider,
  pool: ethers.Contract,
  reserveAddress: string,
  userAddress: string
): Promise<RawReserveBalances | null> {
  try {
    const ur = await pool.getUserReserveData(reserveAddress, userAddress);
    return {
      suppliedRaw: ur.currentATokenBalance,
      borrowedRaw: ur.currentVariableDebt + ur.currentStableDebt,
    };
  } catch (err) {
    console.warn(`getUserReserveData failed for ${reserveAddress}, trying balanceOf:`, errorMessage(err));
  }

  try {
    const rd = await pool.getReserveData(reserveAddress);
    const [suppliedRaw, variableDebtRaw, stableDebtRaw] = await Promise.all([
      fetchTokenBalance(provider, rd.aTokenAddress, userAddress),
      fetchTokenBalance(provider, rd.variableDebtTokenAddress, userAddress),
      fetchTokenBalance(provider, rd.stableDebtTokenAddress, userAddress),
    ]);
    return { suppliedRaw, borrowedRaw: variableDebtRaw + stableDebtRaw };
  } catch (err) {
    console.warn(`balanceOf fallback failed for ${reserveAddress}, skipping reserve:`, errorMessage(err));
    return null;
  }
}

/**
 * Fetches a user's Tydro position (works for connected wallets AND pasted
 * read-only addresses). Returns null when the user has no active position.
 *
 * The pool's canonical user reads (getUserAccountData / getUserReserveData)
 * report ALL ZEROS or revert for some accounts that genuinely hold aToken
 * balances (verified on chain), so the position is rebuilt from per-reserve
 * aToken/debt-token `balanceOf` reads whenever the pool reports nothing.
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

  const accountCollateralUsd = Number(
    ethers.formatUnits(accountData.totalCollateralBase, BASE_CURRENCY_DECIMALS)
  );
  const accountDebtUsd = Number(
    ethers.formatUnits(accountData.totalDebtBase, BASE_CURRENCY_DECIMALS)
  );

  // Pass 1 — raw balances per reserve (cheap; no metadata yet). This is the
  // source of truth even when the pool's account-level reads lie or revert.
  const rawBalances = await mapWithConcurrency(reserveAddresses, 6, (reserveAddress) =>
    fetchReserveBalances(provider, pool, reserveAddress, address)
  );

  const pairs: Array<{ reserveAddress: string; balances: RawReserveBalances }> = [];
  for (let i = 0; i < reserveAddresses.length; i += 1) {
    const balances = rawBalances[i];
    if (balances && (balances.suppliedRaw > BigInt(0) || balances.borrowedRaw > BigInt(0))) {
      pairs.push({ reserveAddress: reserveAddresses[i], balances });
    }
  }

  const rows: Array<{
    asset: TydroAssetRef;
    suppliedAmount: number;
    borrowedAmount: number;
    ltvPct: number;
    liquidationThresholdPct: number;
  }> = [];

  // Pass 2 — value only the reserves with actual holdings. One flaky metadata
  // call skips that reserve, never the whole position.
  await mapWithConcurrency(pairs, 6, async ({ reserveAddress, balances }) => {
    try {
      const [config, priceRaw, symbol] = await Promise.all([
        pdp.getReserveConfigurationData(reserveAddress),
        oracle.getAssetPrice(reserveAddress),
        fetchReserveSymbol(provider, reserveAddress),
      ]);
      const decimals = Number(config.decimals);
      rows.push({
        asset: {
          address: reserveAddress,
          symbol,
          decimals,
          priceUsd: Number(ethers.formatUnits(priceRaw, BASE_CURRENCY_DECIMALS)),
        },
        suppliedAmount: Number(ethers.formatUnits(balances.suppliedRaw, decimals)),
        borrowedAmount: Number(ethers.formatUnits(balances.borrowedRaw, decimals)),
        ltvPct: Number(config.ltv) / 1e4,
        liquidationThresholdPct: Number(config.liquidationThreshold) / 1e4,
      });
    } catch (err) {
      console.warn(`Tydro reserve ${reserveAddress} metadata failed, skipping:`, errorMessage(err));
    }
  });

  const supplies: TydroUserSupply[] = [];
  const borrows: TydroUserBorrow[] = [];

  for (const { asset, suppliedAmount, borrowedAmount } of rows) {
    if (suppliedAmount > 0) {
      supplies.push({ asset, amount: suppliedAmount, amountUsd: suppliedAmount * asset.priceUsd });
    }
    if (borrowedAmount > 0) {
      borrows.push({ asset, amount: borrowedAmount, amountUsd: borrowedAmount * asset.priceUsd });
    }
  }

  supplies.sort((a, b) => b.amountUsd - a.amountUsd);
  borrows.sort((a, b) => b.amountUsd - a.amountUsd);

  // No active position (nothing supplied, nothing borrowed).
  if (supplies.length === 0 && borrows.length === 0) return null;

  const balanceCollateralUsd = supplies.reduce((sum, r) => sum + r.amountUsd, 0);
  const balanceDebtUsd = borrows.reduce((sum, r) => sum + r.amountUsd, 0);

  // When the pool reports a real position, its aggregates are canonical and
  // the per-reserve rows only feed the breakdown. When the pool reports zeros
  // but token balances exist, the position is rebuilt from those balances.
  const useAccountData = accountCollateralUsd > 0 || accountDebtUsd > 0;

  let totalCollateralUsd: number;
  let totalDebtUsd: number;
  let availableBorrowsUsd: number;
  let liquidationThresholdPct: number;
  let ltvPct: number;
  let healthFactor: number;

  if (useAccountData) {
    totalCollateralUsd = accountCollateralUsd;
    totalDebtUsd = accountDebtUsd;
    availableBorrowsUsd = Number(
      ethers.formatUnits(accountData.availableBorrowsBase, BASE_CURRENCY_DECIMALS)
    );
    liquidationThresholdPct = Number(accountData.currentLiquidationThreshold) / 1e4;
    ltvPct = Number(accountData.ltv) / 1e4;
    healthFactor = formatHealthFactor(accountData.healthFactor);
  } else {
    totalCollateralUsd = balanceCollateralUsd;
    totalDebtUsd = balanceDebtUsd;
    liquidationThresholdPct =
      balanceCollateralUsd > 0
        ? rows.reduce(
            (sum, r) => sum + r.suppliedAmount * r.asset.priceUsd * r.liquidationThresholdPct,
            0
          ) / balanceCollateralUsd
        : 0;
    ltvPct =
      balanceCollateralUsd > 0
        ? rows.reduce((sum, r) => sum + r.suppliedAmount * r.asset.priceUsd * r.ltvPct, 0) /
          balanceCollateralUsd
        : 0;
    healthFactor =
      balanceDebtUsd > 0 && liquidationThresholdPct > 0
        ? (balanceCollateralUsd * liquidationThresholdPct) / 100 / balanceDebtUsd
        : Number.POSITIVE_INFINITY;
    availableBorrowsUsd = Math.max((balanceCollateralUsd * ltvPct) / 100 - balanceDebtUsd, 0);
  }

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
