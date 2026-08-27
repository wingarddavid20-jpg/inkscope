'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Globe,
  Layers,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCompact, formatPercent } from '@/lib/format';
import { useEcosystem } from '@/hooks/use-ecosystem';
import type { EcosystemOverview, EcosystemProtocol } from '@/lib/ecosystem';

/**
 * Ink Ecosystem Overview — hybrid live data:
 * Tydro via on-chain RPC, Nado via indexer, third-party protocols via
 * DefiLlama (Ink chainTvls). Missing numbers render as "N/A" — never fake.
 */
export function EcosystemPanel() {
  const { data, loading, error, refetch } = useEcosystem();

  return (
    <section id="ecosystem" className="scroll-mt-20">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6]/15">
          <Globe className="h-5 w-5 text-[#B99CFF]" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">Ink Ecosystem</h2>
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-400/30 bg-emerald-400/10 font-display text-[10px] text-emerald-300"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live · Ink Mainnet
            </Badge>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            TVL &amp; volume across the top protocols building on Ink
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

      {error && !data && <EcosystemError onRetry={refetch} />}

      {!data && !error && <EcosystemSkeleton />}

      {data && <EcosystemBody overview={data} />}
    </section>
  );
}

function EcosystemBody({ overview }: { overview: EcosystemOverview }) {
  const reporting = overview.protocols.filter((p) => p.tvlUsd != null).length;

  return (
    <>
      {/* Total TVL banner */}
      <Card
        className="glass mb-4 border-border/60 p-5 animate-fade-in-up"
        style={{ animationDelay: '60ms' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8B5CF6]/15">
              <Layers className="h-6 w-6 text-[#B99CFF]" />
            </div>
            <div>
              <p className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total TVL · tracked protocols
              </p>
              <p className="font-display text-3xl font-bold">
                {overview.totalTvlUsd != null ? formatCompact(overview.totalTvlUsd) : 'N/A'}
              </p>
            </div>
          </div>
          <p className="font-body text-xs text-muted-foreground sm:text-right">
            {reporting} of {overview.protocols.length} protocols reporting
            <br />
            Updated {new Date(overview.updatedAt).toLocaleTimeString()} · refreshes every 10 min
          </p>
        </div>
      </Card>

      {/* Protocol grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.protocols.map((protocol, index) => (
          <ProtocolCard key={protocol.id} protocol={protocol} delay={120 + index * 40} />
        ))}
      </div>
    </>
  );
}

function ProtocolCard({ protocol, delay }: { protocol: EcosystemProtocol; delay: number }) {
  const tvl = protocol.tvlUsd;
  const change = protocol.change24h;

  const secondary =
    protocol.borrowsUsd != null
      ? `borrows ${formatCompact(protocol.borrowsUsd)}`
      : protocol.volume24hUsd != null
        ? `24h volume ${formatCompact(protocol.volume24hUsd)}`
        : null;

  return (
    <Card
      className="glass border-border/60 p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <ProtocolLogo protocol={protocol} />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold">{protocol.name}</p>
            <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
              {protocol.category}
            </p>
          </div>
        </div>
        {protocol.url ? (
          <a
            href={protocol.url}
            target="_blank"
            rel="noreferrer"
            title={`Open ${protocol.name}`}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-xs uppercase tracking-wider text-muted-foreground">TVL</p>
          <p className="mt-0.5 font-display text-xl font-bold">{tvl != null ? formatCompact(tvl) : 'N/A'}</p>
        </div>
        {change != null ? (
          <span
            className={cn(
              'flex items-center gap-1 font-display text-xs font-semibold',
              change >= 0 ? 'text-emerald-300' : 'text-rose-300'
            )}
          >
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPercent(change)}
          </span>
        ) : (
          <span className="font-body text-xs text-muted-foreground/60">—</span>
        )}
      </div>

      {secondary && <p className="mt-1.5 font-body text-xs text-muted-foreground">{secondary}</p>}

      <div className="mt-3 border-t border-border/40 pt-2">
        <span className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {protocol.source === 'rpc'
            ? 'Tydro · on-chain'
            : protocol.source === 'indexer'
              ? 'Nado · indexer'
              : 'DefiLlama'}
        </span>
      </div>
    </Card>
  );
}

/** DefiLlama logo (next/image, unoptimized) with letter-avatar fallback. */
function ProtocolLogo({ protocol }: { protocol: EcosystemProtocol }) {
  const [failed, setFailed] = useState(false);

  if (protocol.logo && !failed) {
    return (
      <Image
        src={protocol.logo}
        alt={`${protocol.name} logo`}
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
      {protocol.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function EcosystemError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="glass mb-4 border-rose-400/30 bg-rose-500/[0.04] p-8 text-center animate-fade-in-up">
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-rose-300" />
      <p className="font-display text-base font-bold">Couldn&apos;t load ecosystem data</p>
      <p className="mx-auto mt-1 max-w-md font-body text-sm text-muted-foreground">
        One of the data sources (RPC, Nado indexer, or DefiLlama) is unreachable — try again.
      </p>
      <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        className="mt-4 gap-2 font-display transition-all hover:border-accent/50 hover:text-[#C8B5FF]"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </Card>
  );
}

function EcosystemSkeleton() {
  return (
    <>
      <Card className="glass mb-4 border-border/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
          <Skeleton className="h-3 w-44" />
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Card key={i} className="glass border-border/60 p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-6 w-20" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
