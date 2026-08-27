'use client';

import { useEffect, useState } from 'react';
import { useTydroOverview } from '@/hooks/use-tydro';
import { getNadoTickers } from '@/lib/nado';
import type { Metric } from '@/components/metric-card';

const POLL_MS = 60_000;

/**
 * Live Key Metrics for the dashboard header row.
 *
 * - TVL / Total Borrows: Tydro lending pool, read on-chain via RPC
 *   (lib/tydro.ts → fetchTydroOverview).
 * - 24h Volume: sum of every product's 24h quote volume from the Nado
 *   indexer tickers endpoint.
 * - Active Wallets: no on-chain source exists yet → null ("N/A").
 */
export function useKeyMetrics(): { metrics: Metric[] } {
  const tydro = useTydroOverview(POLL_MS);

  const [nadoVolumeUsd, setNadoVolumeUsd] = useState<number | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadVolume() {
      try {
        const tickers = await getNadoTickers();
        if (cancelled) return;
        let total = 0;
        tickers.forEach((t) => {
          total += t.volume;
        });
        setNadoVolumeUsd(total);
      } catch (err) {
        console.warn('Nado 24h volume fetch failed:', err);
        if (!cancelled) setNadoVolumeUsd(null);
      } finally {
        if (!cancelled) setVolumeLoading(false);
      }
    }

    void loadVolume();
    const interval = setInterval(loadVolume, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const tvlLoading = tydro.loading && tydro.data === null;

  return {
    metrics: [
      {
        label: 'TVL',
        value: tydro.data?.tvlUsd ?? null,
        pending: tvlLoading,
        source: 'Tydro · on-chain',
      },
      {
        label: '24h Volume',
        value: nadoVolumeUsd,
        pending: volumeLoading,
        source: 'Nado · indexer',
      },
      {
        label: 'Active Wallets',
        value: null,
        pending: false,
        source: 'Not available yet',
      },
      {
        label: 'Total Borrows',
        value: tydro.data?.totalBorrowUsd ?? null,
        pending: tvlLoading,
        source: 'Tydro · on-chain',
      },
    ],
  };
}
