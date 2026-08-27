// ─────────────────────────────────────────────────────────────────────────────
// Tydro subgraph — GraphQL queries + result mapping (Apollo Client).
//
// The queries target the STANDARD Aave V3 subgraph schema (aave/protocol-
// subgraphs layout: Reserve / User / Position / PositionAsset entities), which
// is what the Tydro white-label deployment is expected to publish.
//
// NOTE: the deployment live at NEXT_PUBLIC_GRAPHQL_ENDPOINT (inkscope/1.0.0)
// tracks the real Tydro protocol but lags the chain head, and its schema lacks
// the Position entities (fields here were verified against the deployed
// schema on 2026-08-26). The panel only trusts subgraph data that is within a
// few blocks of the RPC chain head (see hooks/use-tydro-subgraph.ts) and falls
// back to the RPC path in lib/tydro.ts while the subgraph is behind.
// ─────────────────────────────────────────────────────────────────────────────

import { gql } from '@apollo/client';
import { formatUnits } from 'ethers';
import type { TydroOverview, TydroReserve } from '@/lib/tydro';

// ── Queries ──────────────────────────────────────────────────────────────────

/** All reserves with supplies, debts, rates and USD prices. */
export const TYDRO_RESERVES_QUERY = gql`
  query TydroReserves($first: Int = 50) {
    reserves(first: $first, orderBy: totalATokenSupply, orderDirection: desc) {
      id
      symbol
      decimals
      totalATokenSupply
      totalPrincipalStableDebt
      totalCurrentVariableDebt
      liquidityRate
      variableBorrowRate
      stableBorrowRate
      utilizationRate
      lastUpdateTimestamp
      price {
        priceInEth
        oracle {
          usdPriceEth
        }
      }
    }
    _meta {
      block {
        number
      }
    }
  }
`;

/** A single user's position — health factor, collateral, debt, per-asset. */
export const TYDRO_USER_POSITION_QUERY = gql`
  query TydroUserPosition($address: Bytes!, $first: Int = 1) {
    users(first: $first, where: { address: $address }) {
      id
      address
      position {
        healthFactor
        ltv
        liquidationThreshold
        collateralBalanceUSD
        borrowBalanceUSD
        collateral {
          balanceUSD
          asset {
            id
            symbol
            decimals
          }
        }
        borrows {
          balanceUSD
          asset {
            id
            symbol
            decimals
          }
        }
      }
    }
  }
`;

/** At-risk positions + top suppliers/borrowers (powers the panel tables). */
export const TYDRO_COMMUNITY_QUERY = gql`
  query TydroCommunity($riskMaxHealthFactor: BigInt!, $riskFirst: Int = 6, $leaderFirst: Int = 8) {
    riskPositions: positions(
      where: { healthFactor_lt: $riskMaxHealthFactor }
      orderBy: healthFactor
      orderDirection: asc
      first: $riskFirst
    ) {
      id
      user {
        address
      }
      healthFactor
      collateralBalanceUSD
      borrowBalanceUSD
    }
    topSuppliers: positions(
      orderBy: collateralBalanceUSD
      orderDirection: desc
      first: $leaderFirst
    ) {
      id
      user {
        address
      }
      collateralBalanceUSD
      borrowBalanceUSD
      healthFactor
    }
    topBorrowers: positions(
      orderBy: borrowBalanceUSD
      orderDirection: desc
      first: $leaderFirst
    ) {
      id
      user {
        address
      }
      collateralBalanceUSD
      borrowBalanceUSD
      healthFactor
    }
  }
`;

// ── Result shapes ────────────────────────────────────────────────────────────

export type SubgraphPriceNode = {
  /** Asset price in ETH, 1e18-scaled (per the Aave V3 subgraph oracle model). */
  priceInEth: string | null;
  /** Price oracle holding the ETH→USD conversion (usdPriceEth, 1e8-scaled). */
  oracle?: { usdPriceEth?: string | null } | null;
};

export type SubgraphReserveNode = {
  id: string;
  symbol: string | null;
  decimals: string | null;
  totalATokenSupply: string | null;
  totalPrincipalStableDebt: string | null;
  totalCurrentVariableDebt: string | null;
  liquidityRate: string | null;
  variableBorrowRate: string | null;
  stableBorrowRate: string | null;
  utilizationRate: string | null;
  lastUpdateTimestamp: string | null;
  price: SubgraphPriceNode | null;
};

/** `_meta.block` reported by the subgraph (used for freshness gating). */
export type SubgraphMeta = {
  block?: { number?: string | null } | null;
} | null;

export type SubgraphPositionNode = {
  id: string;
  user?: { address?: string | null } | null;
  healthFactor?: string | null;
  collateralBalanceUSD?: string | null;
  borrowBalanceUSD?: string | null;
};

export type SubgraphCommunityData = {
  riskPositions?: SubgraphPositionNode[] | null;
  topSuppliers?: SubgraphPositionNode[] | null;
  topBorrowers?: SubgraphPositionNode[] | null;
};

export type TydroRiskPosition = {
  address: string;
  healthFactor: number;
  collateralUsd: number;
  debtUsd: number;
};

export type TydroLeader = {
  address: string;
  balanceUsd: number;
};

export type SubgraphUserPosition = {
  address: string;
  healthFactor: number;
  ltvPct: number;
  liquidationThresholdPct: number;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  supplies: { symbol: string; decimals: number; balanceUsd: number }[];
  borrows: { symbol: string; decimals: number; balanceUsd: number }[];
};

// ── Mapping helpers ──────────────────────────────────────────────────────────

const RAY = 1e27;
// NOTE: BigInt() call instead of literal — the project tsconfig targets es5.
const ETH_UNIT = BigInt('1000000000000000000'); // 1e18

function toNumber(value: string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Aave ray (1e27) → percent. */
function rayToPercent(ray: string | null | undefined): number {
  return (toNumber(ray) / RAY) * 100;
}

/**
 * Health factor from the subgraph. The standard Aave subgraph stores the
 * contract's raw 1e18-scaled value; some deployments store a plain decimal —
 * normalize both.
 */
function healthFactorValue(raw: string | null | undefined): number {
  const v = toNumber(raw);
  return v > 1e12 ? v / 1e18 : v;
}

/** Subgraph reserves → the TydroOverview shape used by the panel. */
export function overviewFromSubgraph(
  data: { reserves?: SubgraphReserveNode[] | null } | undefined
): TydroOverview | null {
  if (!data?.reserves) return null;

  const reserves: TydroReserve[] = [];

  for (const r of data.reserves) {
    const decimals = Number(r.decimals) || 18;
    const supplied = Number(
      formatUnits(BigInt(r.totalATokenSupply || '0'), decimals)
    );
    const borrowed = Number(
      formatUnits(
        BigInt(r.totalPrincipalStableDebt || '0') +
          BigInt(r.totalCurrentVariableDebt || '0'),
        decimals
      )
    );
    // USD price: priceInEth (asset in ETH, 1e18) × usdPriceEth (ETH in USD,
    // 1e8) / 1e18 → USD at 1e8 scale. 0 when the oracle data isn't indexed.
    const priceInEth = BigInt(r.price?.priceInEth || '0');
    const usdPriceEth = BigInt(r.price?.oracle?.usdPriceEth || '0');
    const priceUsd =
      priceInEth > BigInt(0) && usdPriceEth > BigInt(0)
        ? Number((priceInEth * usdPriceEth) / ETH_UNIT) / 1e8
        : 0;
    // utilizationRate is a fraction (0.41 = 41%) in the standard schema;
    // fall back to supplies/debts when it's missing.
    const utilization =
      r.utilizationRate !== null && r.utilizationRate !== undefined
        ? toNumber(r.utilizationRate) * 100
        : supplied > 0
          ? (borrowed / supplied) * 100
          : 0;

    reserves.push({
      address: r.id.toLowerCase(),
      symbol: r.symbol || `${r.id.slice(0, 4)}…${r.id.slice(-3)}`.toUpperCase(),
      decimals,
      supplied,
      borrowed,
      available: Math.max(supplied - borrowed, 0),
      utilization,
      supplyApy: rayToPercent(r.liquidityRate),
      borrowApy: rayToPercent(r.variableBorrowRate),
      priceUsd,
      suppliedUsd: supplied * priceUsd,
      borrowedUsd: borrowed * priceUsd,
    });
  }

  const sorted = reserves
    .filter((res) => res.supplied > 0 || res.borrowed > 0)
    .sort((a, b) => b.suppliedUsd - a.suppliedUsd);

  if (sorted.length === 0) return null;

  const tvlUsd = sorted.reduce((sum, res) => sum + res.suppliedUsd, 0);
  const totalBorrowUsd = sorted.reduce((sum, res) => sum + res.borrowedUsd, 0);
  const availableUsd = sorted.reduce(
    (sum, res) => sum + res.suppliedUsd - res.borrowedUsd,
    0
  );

  return {
    tvlUsd,
    totalBorrowUsd,
    availableUsd,
    utilization: tvlUsd > 0 ? (totalBorrowUsd / tvlUsd) * 100 : 0,
    reserves: sorted,
    updatedAt: Date.now(),
  };
}

/** Positions with health factor < threshold → risk rows. */
export function riskPositionsFromSubgraph(
  data: SubgraphCommunityData | undefined
): TydroRiskPosition[] | null {
  const nodes = data?.riskPositions;
  if (!nodes) return null;
  return nodes
    .map((p) => ({
      address: p.user?.address?.toLowerCase() ?? p.id.toLowerCase(),
      healthFactor: healthFactorValue(p.healthFactor),
      collateralUsd: toNumber(p.collateralBalanceUSD),
      debtUsd: toNumber(p.borrowBalanceUSD),
    }))
    .filter((p) => p.healthFactor > 0);
}

/** Positions ordered by a USD balance → leaderboard rows. */
export function leadersFromSubgraph(
  nodes: SubgraphPositionNode[] | null | undefined,
  balanceKey: 'collateralBalanceUSD' | 'borrowBalanceUSD'
): TydroLeader[] | null {
  if (!nodes) return null;
  return nodes.map((p) => ({
    address: p.user?.address?.toLowerCase() ?? p.id.toLowerCase(),
    balanceUsd: toNumber(p[balanceKey]),
  }));
}

/** A single user's position from the subgraph → typed position. */
export function userPositionFromSubgraph(
  data: {
    users?: { id: string; position?: SubgraphUserPositionNode | null }[] | null;
  } | undefined
): SubgraphUserPosition | null {
  const user = data?.users?.[0];
  const position = user?.position;
  if (!user || !position) return null;

  return {
    address: user.id.toLowerCase(),
    healthFactor: healthFactorValue(position.healthFactor),
    ltvPct: toNumber(position.ltv) / 1e4,
    liquidationThresholdPct: toNumber(position.liquidationThreshold) / 1e4,
    totalCollateralUsd: toNumber(position.collateralBalanceUSD),
    totalDebtUsd: toNumber(position.borrowBalanceUSD),
    supplies: (position.collateral ?? []).map((a) => ({
      symbol: a.asset?.symbol ?? a.asset?.id ?? '?',
      decimals: Number(a.asset?.decimals) || 18,
      balanceUsd: toNumber(a.balanceUSD),
    })),
    borrows: (position.borrows ?? []).map((a) => ({
      symbol: a.asset?.symbol ?? a.asset?.id ?? '?',
      decimals: Number(a.asset?.decimals) || 18,
      balanceUsd: toNumber(a.balanceUSD),
    })),
  };
}

type SubgraphUserPositionNode = {
  healthFactor?: string | null;
  ltv?: string | null;
  liquidationThreshold?: string | null;
  collateralBalanceUSD?: string | null;
  borrowBalanceUSD?: string | null;
  collateral?: { balanceUSD?: string | null; asset?: { id: string; symbol?: string | null; decimals?: string | null } | null }[] | null;
  borrows?: { balanceUSD?: string | null; asset?: { id: string; symbol?: string | null; decimals?: string | null } | null }[] | null;
};
