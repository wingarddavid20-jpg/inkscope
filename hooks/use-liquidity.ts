'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLiquidityFlows, type LiquidityFlowData } from '@/lib/liquidity';

const POLL_MS = 60_000;

export type UseLiquidityState = {
  /** Aggregated flows; null while loading or when the source is unavailable. */
  data: LiquidityFlowData | null;
  loading: boolean;
  /** Network/config failure — the panel renders N/A. */
  error: string | null;
  /** The subgraph schema doesn't expose flow entities yet — N/A, not an error. */
  unavailable: boolean;
  refetch: () => void;
};

/**
 * Polls the Goldsky subgraph for bridge/CEX flow volumes every 60s. Keeps the
 * last successful payload across transient poll failures (like the Tydro
 * hooks) so a blip doesn't blank the panel; N/A is only shown when there is
 * no data at all (endpoint down or the schema lacks the flow entities).
 */
export function useLiquidity(pollMs: number = POLL_MS): UseLiquidityState {
  const [data, setData] = useState<LiquidityFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const pollMsRef = useRef(pollMs);

  useEffect(() => {
    pollMsRef.current = pollMs;
  }, [pollMs]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await fetchLiquidityFlows();
      if (cancelled) return;

      setLoading(false);
      if (result.available) {
        setData(result.data);
        setError(null);
        setUnavailable(false);
      } else {
        setUnavailable(result.reason === 'unsupported');
        setError(result.reason === 'error' ? result.message : null);
        // Keep the last payload on transient errors; N/A only when the source
        // is genuinely unsupported or we never had data.
        if (result.reason === 'unsupported') setData(null);
      }
    }

    void load();

    const interval = pollMsRef.current > 0
      ? window.setInterval(load, pollMsRef.current)
      : undefined;

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [refreshKey]);

  return { data, loading, error, unavailable, refetch };
}
