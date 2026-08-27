'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTydroOverview,
  fetchTydroUserPosition,
  getTydroErrorMessage,
  type TydroOverview,
  type TydroUserPosition,
} from '@/lib/tydro';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * Fetches the live Tydro protocol overview (TVL, borrows, per-reserve data)
 * from the chain. Optionally polls on an interval (ms). Exposes `refetch`.
 */
export function useTydroOverview(pollMs?: number) {
  const [state, setState] = useState<AsyncState<TydroOverview>>({
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
        const data = await fetchTydroOverview();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: getTydroErrorMessage(err) }));
        }
      }
    }

    load();

    const interval = pollMsRef.current
      ? setInterval(load, pollMsRef.current)
      : undefined;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // pollMs in deps so polling stops when the caller passes undefined
    // (the Tydro panel pauses RPC polling once the subgraph takes over).
  }, [refreshKey, pollMs]);

  return { ...state, refetch };
}

/**
 * Fetches a user's live Tydro position. `address` is the connected wallet OR a
 * pasted read-only address. When `address` is falsy the hook stays idle.
 * Returns `data: null` both while idle and when the user has no position.
 */
export function useTydroUserPosition(address: string | null | undefined, pollMs?: number) {
  const [state, setState] = useState<AsyncState<TydroUserPosition>>({
    data: null,
    loading: false,
    error: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const pollMsRef = useRef(pollMs);

  useEffect(() => {
    pollMsRef.current = pollMs;
  }, [pollMs]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!address) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    // const capture so TS narrowing survives inside the async closure below
    const targetAddress = address;
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const position = await fetchTydroUserPosition(targetAddress);
        if (!cancelled) setState({ data: position, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: getTydroErrorMessage(err) }));
        }
      }
    }

    load();

    const interval = pollMsRef.current
      ? setInterval(load, pollMsRef.current)
      : undefined;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [address, refreshKey]);

  return { ...state, refetch };
}
