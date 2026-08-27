'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  TYDRO_RESERVES_QUERY,
  TYDRO_COMMUNITY_QUERY,
  overviewFromSubgraph,
  riskPositionsFromSubgraph,
  leadersFromSubgraph,
  type SubgraphCommunityData,
  type SubgraphMeta,
  type SubgraphReserveNode,
  type TydroRiskPosition,
  type TydroLeader,
} from '@/lib/queries/tydro';
import { useTydroOverview } from '@/hooks/use-tydro';
import { getTydroProvider, type TydroOverview } from '@/lib/tydro';

const POLL_MS = 60_000;
/** HF below 1.5 counts as "at risk" (1.0 = liquidation). 1e18-scaled. */
const RISK_MAX_HF = '1500000000000000000';
/**
 * The subgraph is only trusted when its indexed head is within this many
 * blocks of the RPC chain head. While Goldsky is catching up (or stuck), the
 * panel keeps serving live RPC data instead of stale subgraph state — and
 * switches over automatically the moment the subgraph catches up.
 */
const SUBGRAPH_MAX_LAG_BLOCKS = 300;

export type TydroSource = 'subgraph' | 'rpc';

export type TydroPanelState = {
  data: TydroOverview | null;
  source: TydroSource;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** null = unavailable (query pending/errored, or RPC fallback mode). */
  positions: TydroRiskPosition[] | null;
  suppliers: TydroLeader[] | null;
  borrowers: TydroLeader[] | null;
  positionsError: string | null;
};

/**
 * Primary data source is the Tydro subgraph (Apollo useQuery). The subgraph is
 * only used when it (a) returns a valid overview AND (b) is fresh — indexed
 * within SUBGRAPH_MAX_LAG_BLOCKS of the RPC chain head. Otherwise the panel
 * falls back to the RPC overview in lib/tydro.ts, and switches back to the
 * subgraph automatically the moment it starts returning fresh data.
 */
export function useTydroPanelData(): TydroPanelState {
  const subgraph = useQuery<{
    reserves?: SubgraphReserveNode[] | null;
    _meta?: SubgraphMeta;
  }>(TYDRO_RESERVES_QUERY, {
    pollInterval: POLL_MS,
    ssr: false,
  });

  // Chain head reference for the subgraph freshness gate. Polled on the same
  // cadence as the subgraph; on failure the head stays null, which keeps the
  // subgraph untrusted (RPC remains the source) — the safe default.
  const [chainHead, setChainHead] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const head = await getTydroProvider().getBlockNumber();
        if (!cancelled) setChainHead(head);
      } catch (err) {
        if (!cancelled) setChainHead(null);
        console.warn('Chain head fetch failed (subgraph freshness unknown):', err);
      }
    };
    void refresh();
    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const overview = useMemo(
    () => overviewFromSubgraph(subgraph.data),
    [subgraph.data]
  );

  const metaBlock = subgraph.data?._meta?.block?.number;
  const subgraphBlock = metaBlock ? Number(metaBlock) : null;
  const subgraphFresh =
    subgraphBlock !== null &&
    chainHead !== null &&
    subgraphBlock >= chainHead - SUBGRAPH_MAX_LAG_BLOCKS;

  // Only treat the subgraph as the live source when it has data AND is fresh.
  const subgraphActive = Boolean(overview) && subgraphFresh;

  if (overview && !subgraphFresh) {
    console.info(
      `Tydro subgraph is stale (indexed block ${subgraphBlock ?? '?'} vs chain head ${chainHead ?? '?'}); using RPC until it catches up.`
    );
  }

  // Risk + leaderboard data only makes sense when the subgraph is live.
  const community = useQuery<SubgraphCommunityData>(TYDRO_COMMUNITY_QUERY, {
    pollInterval: POLL_MS,
    ssr: false,
    skip: !subgraphActive,
    variables: { riskMaxHealthFactor: RISK_MAX_HF },
  });

  const positions = useMemo<TydroRiskPosition[] | null>(
    () => (community.data ? riskPositionsFromSubgraph(community.data) : null),
    [community.data]
  );
  const suppliers = useMemo<TydroLeader[] | null>(
    () =>
      community.data
        ? leadersFromSubgraph(community.data.topSuppliers, 'collateralBalanceUSD')
        : null,
    [community.data]
  );
  const borrowers = useMemo<TydroLeader[] | null>(
    () =>
      community.data
        ? leadersFromSubgraph(community.data.topBorrowers, 'borrowBalanceUSD')
        : null,
    [community.data]
  );

  // RPC fallback — only polls while the subgraph is unavailable OR stale, so
  // we don't hammer the RPC endpoint once the subgraph is healthy.
  const rpc = useTydroOverview(subgraphActive ? undefined : POLL_MS);

  const data = subgraphActive ? overview : rpc.data;
  const loading = !data && (subgraph.loading || rpc.loading);
  const error = !data ? (subgraph.error?.message ?? rpc.error) : null;
  const source: TydroSource = subgraphActive ? 'subgraph' : 'rpc';

  if (subgraph.error) {
    console.warn('Tydro subgraph query failed, using RPC fallback:', subgraph.error.message);
  }

  const refetch = useCallback(() => {
    void subgraph.refetch();
    rpc.refetch();
  }, [rpc, subgraph]);

  return {
    data,
    source,
    loading,
    error,
    refetch,
    positions,
    suppliers,
    borrowers,
    positionsError: community.error?.message ?? null,
  };
}
