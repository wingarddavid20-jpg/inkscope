'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import fallbackNfts from '@/data/nfts.json';

type NftItem = {
  id: string;
  name: string;
  logo: string | null;
  floorPrice: number | null;
  volume24h: number | null;
  totalSupply: number | null;
  url: string | null;
};

/** OpenSea v2 list-item shape (defensive — only the fields we map). */
type OpenseaCollection = {
  collection?: string;
  name?: string;
  image_url?: string | null;
  floor_price?: number | null;
  one_day_volume?: number | null;
  total_supply?: number | null;
  opensea_url?: string | null;
};

const OPENSEA_URL =
  'https://api.opensea.io/api/v2/collections?chain=ink&limit=10&order_by=volume';
const FETCH_TIMEOUT_MS = 8_000;

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapOpenseaItem(raw: OpenseaCollection): NftItem {
  const slug = raw.collection;
  const name = raw.name ?? slug ?? 'Unknown collection';
  return {
    id: slug ?? name,
    name,
    logo: raw.image_url ?? null,
    floorPrice: finiteNumber(raw.floor_price),
    // The v2 list endpoint does not include per-day volume for every collection;
    // render "—" (never fabricate) when the field is absent.
    volume24h: finiteNumber(raw.one_day_volume),
    totalSupply: finiteNumber(raw.total_supply),
    url: raw.opensea_url ?? (slug ? `https://opensea.io/collection/${slug}` : null),
  };
}

/** OpenSea requires an X-API-KEY; without one the request fails and we fall back to static data. */
async function fetchTrendingNfts(): Promise<NftItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const apiKey = process.env.NEXT_PUBLIC_OPENSEA_API_KEY;
    const res = await fetch(OPENSEA_URL, {
      signal: controller.signal,
      headers: apiKey ? { 'X-API-KEY': apiKey } : undefined,
    });
    if (!res.ok) throw new Error(`OpenSea API ${res.status}`);
    const json = (await res.json()) as { collections?: unknown[] };
    const items = (json.collections ?? []).map((c) => mapOpenseaItem(c as OpenseaCollection));
    if (items.length === 0) throw new Error('OpenSea returned no collections');
    return items;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Trending NFTs — top collections on Ink.
 * Live data from OpenSea (v2 API, chain=ink, sorted by volume); falls back to
 * data/nfts.json when the API is unreachable or no API key is configured.
 */
export function TrendingNfts() {
  const [items, setItems] = useState<NftItem[] | null>(null);
  const [source, setSource] = useState<'opensea' | 'fallback' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const live = await fetchTrendingNfts();
        if (!cancelled) {
          setItems(live);
          setSource('opensea');
        }
      } catch {
        // Graceful fallback: static placeholder data.
        if (!cancelled) {
          setItems(fallbackNfts as NftItem[]);
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
    <section id="trending-nfts" className="scroll-mt-20">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6]/15">
          <Sparkles className="h-5 w-5 text-[#B99CFF]" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">Trending NFTs</h2>
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-400/30 bg-emerald-400/10 font-display text-[10px] text-emerald-300"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live · Ink Mainnet
            </Badge>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Top NFT collections trading on Ink this week
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

      {loading && !items && <NftSkeleton />}

      {items && items.length === 0 && (
        <Card className="glass border-border/60 p-8 text-center animate-fade-in-up">
          <p className="font-display text-base font-bold">No data available</p>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            No NFT collections found on Ink right now.
          </p>
        </Card>
      )}

      {items && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((nft, index) => (
            <NftCard key={nft.id} nft={nft} source={source} delay={80 + index * 40} />
          ))}
        </div>
      )}
    </section>
  );
}

function NftCard({
  nft,
  source,
  delay,
}: {
  nft: NftItem;
  source: 'opensea' | 'fallback' | null;
  delay: number;
}) {
  return (
    <Card
      className="glass flex flex-col border-border/60 p-4 animate-fade-in-up transition-transform duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <NftLogo nft={nft} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold">{nft.name}</p>
          <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
            {source === 'opensea' ? 'OpenSea · live' : 'Fallback data'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NftStat label="Floor" value={formatEth(nft.floorPrice)} />
        <NftStat label="24h Vol" value={formatEth(nft.volume24h)} />
        <NftStat
          label="Supply"
          value={nft.totalSupply != null ? formatNumber(nft.totalSupply) : 'N/A'}
        />
      </div>

      {nft.url ? (
        <a
          href={nft.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border/60 py-2 font-display text-xs font-semibold text-[#C8B5FF] transition-colors hover:border-accent/50 hover:text-[#D8C7FF]"
        >
          View on OpenSea
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </Card>
  );
}

function NftStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-display text-xs font-bold">{value}</p>
    </div>
  );
}

/** OpenSea image (next/image, unoptimized) with letter-avatar fallback. */
function NftLogo({ nft }: { nft: NftItem }) {
  const [failed, setFailed] = useState(false);

  if (nft.logo && !failed) {
    return (
      <Image
        src={nft.logo}
        alt={`${nft.name} logo`}
        width={40}
        height={40}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-lg bg-secondary object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary font-display text-xs font-bold text-[#C8B5FF]">
      {nft.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function formatEth(value: number | null): string {
  if (value == null) return 'N/A';
  if (value >= 1_000) return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETH`;
  if (value >= 1) return `${value.toFixed(2)} ETH`;
  return `${value.toFixed(3)} ETH`;
}

function NftSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="glass border-border/60 p-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-8 w-full rounded-lg" />
        </Card>
      ))}
    </div>
  );
}
