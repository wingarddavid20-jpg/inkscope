'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEcosystemOverview, type EcosystemOverview } from '@/lib/ecosystem';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const DEFAULT_POLL_MS = 600_000;

/**
 * Live Ink Ecosystem overview (Tydro RPC + Nado indexer + DefiLlama).
 * Polls every 10 minutes by default; exposes `refetch`.
 */
export function useEcosystem(pollMs = DEFAULT_POLL_MS) {
  const [state, setState] = useState<AsyncState<EcosystemOverview>>({
    data: null,
    loading: true,
    error: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const pollMsRef = useRef(pollMs);

  useEffect(() => {
    pollMsRef.current = pollMs;
  }, [pollMs]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, loading: prev.data === null, error: null }));
      try {
        const data = await fetchEcosystemOverview();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load ecosystem data',
          }));
        }
      }
    }

    void load();
    const interval = pollMsRef.current ? setInterval(load, pollMsRef.current) : undefined;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [refreshKey, pollMs]);

  return { ...state, refetch };
}
