'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchNadoRecentTrades,
  fetchNadoTopPairs,
  fetchNadoUserTrades,
  getNadoErrorMessage,
  type NadoPair,
  type NadoTrade,
} from '@/lib/nado';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * Latest Nado fills across the DEX (newest first). Optionally polls on an
 * interval (ms). Exposes `refetch`.
 */
export function useNadoRecentTrades(pollMs?: number) {
  const [state, setState] = useState<AsyncState<NadoTrade[]>>({
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
        const data = await fetchNadoRecentTrades();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: getNadoErrorMessage(err) }));
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
  }, [refreshKey]);

  return { ...state, refetch };
}

/**
 * Top Nado pairs by 24h volume, with on-chain open interest. Polls on an
 * optional interval. Exposes `refetch`.
 */
export function useNadoTopPairs(pollMs?: number) {
  const [state, setState] = useState<AsyncState<NadoPair[]>>({
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
        const data = await fetchNadoTopPairs();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: getNadoErrorMessage(err) }));
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
  }, [refreshKey]);

  return { ...state, refetch };
}

/**
 * Trade history for a wallet's default Nado subaccount. `address` is the
 * connected wallet OR a pasted read-only address. When `address` is falsy the
 * hook stays idle (loading: false, data: null).
 */
export function useNadoUserTrades(address: string | null | undefined, pollMs?: number) {
  const [state, setState] = useState<AsyncState<NadoTrade[]>>({
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

    const targetAddress = address;
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await fetchNadoUserTrades(targetAddress);
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: getNadoErrorMessage(err) }));
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
