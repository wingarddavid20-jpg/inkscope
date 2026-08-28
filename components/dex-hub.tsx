'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeftRight, ExternalLink, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatCompact } from '@/lib/format';
import fallbackDexs from '@/data/dexs.json';

type DexItem = {
  id: string;
  name: string;
  logo: string | null;
  tvl: number | null;
  volume24h: number | null;
  topPair: string | null;
  url: string | null;
};

const DL_INKYSWAP_URL = 'https://api.llama.fi/protocol/inkyswap';
const INKYSWAP_PAIRS_URL = 'https://inkyswap.com/api/pairs';
const FETCH_TIMEOUT_MS = 8_000;

/**
 * InkySwap TVL from DefiLlama: chainTvls.Ink.tvl is a time series of
 * {date, totalLiquidityUSD} — the LATEST entry is the current TVL.
 * (The /api/pairs `liquidity_usd` field is unreliable — probe summed to $15.8T
 * from garbage values — so DefiLlama is the authoritative TVL source.)
 */
async function fetchDlInkySwapTvl(): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DL_INKYSWAP_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
    const detail = (await res.json()) as {
      chainTvls?: { Ink?: { tvl?: Array<{ totalLiquidityUSD?: number | null }> } };
    };
    const tvl = detail?.chainTvls?.Ink?.tvl;
    if (!Array.isArray(tvl) || tvl.length === 0) return null;
    const last = tvl[tvl.length - 1]?.totalLiquidityUSD;
    return typeof last === 'number' && Number.isFinite(last) ? last : null;
  } finally {
    clearTimeout(timer);
  }
}

type InkySwapPair = {
  token0?: { symbol?: string };
  token1?: { symbol?: string };
  volume_24h?: number;
};

/** InkySwap 24h volume (sum over pairs) + top pair (highest 24h volume). */
async function fetchInkySwapStats(): Promise<{ volume24h: number | null; topPair: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(INKYSWAP_PAIRS_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`InkySwap ${res.status}`);
    const pairs = (await res.json()) as InkySwapPair[];
    if (!Array.isArray(pairs)) throw new Error('InkySwap returned an unexpected shape');

    let volume = 0;
    let topVolume = 0;
    let topPair: string | null = null;
    pairs.forEach((pair) => {
      const v =
        typeof pair.volume_24h === 'number' && Number.isFinite(pair.volume_24h) && pair.volume_24h > 0
          ? pair.volume_24h
          : 0;
      if (v > 0) volume += v;
      if (v > topVolume) {
        topVolume = v;
        const s0 = pair.token0?.symbol;
        const s1 = pair.token1?.symbol;
        topPair = s0 && s1 ? `${s0}/${s1}` : null;
      }
    });

    const volume24h = volume > 0 && volume < 1e12 ? volume : null;
    return { volume24h, topPair };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * DEX Hub — where to trade on Ink.
 * Live row from DefiLlama (InkySwap TVL) + InkySwap pairs API (volume, top pair);
 * falls back to data/dexs.json when both APIs are unreachable.
 */
export function DexHub() {
  const [items, setItems] = useState<DexItem[] | null>(null);
  const [source, setSource] = useState<'live' | 'fallback' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [dl, pairs] = await Promise.allSettled([fetchDlInkySwapTvl(), fetchInkySwapStats()]);
        if (dl.status === 'rejected' && pairs.status === 'rejected') {
          throw new Error('both sources unreachable');
        }
        if (!cancelled) {
          setItems([
            {
              id: 'inkyswap',
              name: 'InkySwap',
              logo: null,
              tvl: dl.status === 'fulfilled' ? dl.value : null,
              volume24h: pairs.status === 'fulfilled' ? pairs.value.volume24h : null,
              topPair: pairs.status === 'fulfilled' ? pairs.value.topPair : null,
              url: 'https://inkyswap.com',
            },
          ]);
          setSource('live');
        }
      } catch {
        // Graceful fallback: static placeholder data.
        if (!cancelled) {
          setItems(fallbackDexs as DexItem[]);
          setSource('fallback');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <section id="dex-hub" className="scroll-mt-20">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6]/15">
          <ArrowLeftRight className="h-5 w-5 text-[#B99CFF]" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">DEX Hub</h2>
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-400/30 bg-emerald-400/10 font-display text-[10px] text-emerald-300"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live · Ink Mainnet
            </Badge>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            DEXs on Ink — TVL, volume, and top pairs
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={loading}
          className="gap-2 font-display transition-all hover:border-accent/50 hover:text-[#C8B5FF]"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {loading ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>

      {loading && !items && <DexSkeleton />}

      {items && items.length === 0 && (
        <Card className="glass border-border/60 p-8 text-center animate-fade-in-up">
          <p className="font-display text-base font-bold">No data available</p>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            No DEX data found on Ink right now.
          </p>
        </Card>
      )}

      {items && items.length > 0 && (
        <Card className="glass overflow-hidden border-border/60 animate-fade-in-up">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-xs uppercase tracking-wider">DEX</TableHead>
                <TableHead className="font-display text-xs uppercase tracking-wider">TVL</TableHead>
                <TableHead className="font-display text-xs uppercase tracking-wider">
                  24h Volume
                </TableHead>
                <TableHead className="font-display text-xs uppercase tracking-wider">
                  Top Pair
                </TableHead>
                <TableHead className="text-right font-display text-xs uppercase tracking-wider">
                  Trade
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((dex, index) => (
                <DexRow key={dex.id} dex={dex} source={source} delay={80 + index * 60} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </section>
  );
}

function DexRow({
  dex,
  source,
  delay,
}: {
  dex: DexItem;
  source: 'live' | 'fallback' | null;
  delay: number;
}) {
  return (
    <TableRow className="animate-fade-in-up hover:bg-secondary/30" style={{ animationDelay: `${delay}ms` }}>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <DexLogo dex={dex} />
          <div className="min-w-0">
            <p className="font-display text-sm font-bold">{dex.name}</p>
            <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
              {source === 'live' ? 'DefiLlama + pairs API' : 'Fallback data'}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="font-display text-sm font-semibold">
          {dex.tvl != null ? formatCompact(dex.tvl) : 'N/A'}
        </p>
      </TableCell>
      <TableCell>
        <p className="font-display text-sm font-semibold">
          {dex.volume24h != null ? formatCompact(dex.volume24h) : 'N/A'}
        </p>
      </TableCell>
      <TableCell>
        {dex.topPair ? (
          <Badge variant="outline" className="font-mono text-xs text-[#C8B5FF]">
            {dex.topPair}
          </Badge>
        ) : (
          <span className="font-body text-sm text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {dex.url ? (
          <a
            href={dex.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 px-3 py-1.5 font-display text-xs font-semibold text-[#C8B5FF] transition-colors hover:border-accent/50 hover:text-[#D8C7FF]"
          >
            Trade on {dex.name}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="font-body text-sm text-muted-foreground/60">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

/** DEX logo (next/image) with letter-avatar fallback. */
function DexLogo({ dex }: { dex: DexItem }) {
  const [failed, setFailed] = useState(false);

  if (dex.logo && !failed) {
    return (
      <Image
        src={dex.logo}
        alt={`${dex.name} logo`}
        width={36}
        height={36}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-9 w-9 shrink-0 rounded-lg bg-secondary object-cover"
      />
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary font-display text-xs font-bold text-[#C8B5FF]">
      {dex.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function DexSkeleton() {
  return (
    <Card className="glass border-border/60">
      <div className="space-y-4 p-5">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-5 gap-4">
          <Skeleton className="h-6 col-span-2" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
        <div className="grid grid-cols-5 gap-4">
          <Skeleton className="h-6 col-span-2" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
        <div className="grid grid-cols-5 gap-4">
          <Skeleton className="h-6 col-span-2" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      </div>
    </Card>
  );
}
