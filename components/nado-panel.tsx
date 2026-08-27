'use client';

import {
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RefreshCw,
  History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCompact, formatPercent, formatPrice, timeAgo, formatAddress } from '@/lib/format';
import { useNadoRecentTrades, useNadoTopPairs, useNadoUserTrades } from '@/hooks/use-nado';
import type { NadoPair, NadoTrade } from '@/lib/nado';

type NadoPanelProps = {
  /** Connected wallet or pasted read-only address — enables the "Your Trades" card. */
  address?: string | null;
};

export function NadoPanel({ address }: NadoPanelProps) {
  const trades = useNadoRecentTrades(30_000);
  const pairs = useNadoTopPairs(30_000);
  const userTrades = useNadoUserTrades(address, 45_000);

  const refreshing = trades.loading || pairs.loading || userTrades.loading;

  const refreshAll = () => {
    trades.refetch();
    pairs.refetch();
    userTrades.refetch();
  };

  return (
    <section id="nado" className="scroll-mt-20">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">Nado</h2>
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-400/30 bg-emerald-400/10 font-display text-[10px] text-emerald-300"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live · Ink Mainnet
            </Badge>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Perpetual DEX — live fills, top pairs &amp; open interest
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={refreshing}
          className="gap-2 font-display transition-all hover:border-accent/50 hover:text-[#C8B5FF]"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent trades */}
        <Card className="glass border-border/60 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base font-bold accent-line">
                Recent Trades
              </CardTitle>
              <Badge variant="outline" className="gap-1 font-display text-xs">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {trades.error && !trades.data && <SectionError message={trades.error} onRetry={trades.refetch} />}
            {trades.loading && !trades.data && <TradesSkeleton rows={5} />}
            {trades.data && trades.data.length === 0 && (
              <p className="py-6 text-center font-body text-sm text-muted-foreground">
                No trades yet.
              </p>
            )}
            {trades.data && trades.data.length > 0 && (
              <div className="space-y-2">
                {trades.data.map((trade) => (
                  <TradeRow key={trade.digest} trade={trade} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top pairs */}
        <Card className="glass border-border/60 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <CardTitle className="font-display text-base font-bold">
                Top Trading Pairs
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {pairs.error && !pairs.data && <SectionError message={pairs.error} onRetry={pairs.refetch} />}
            {pairs.loading && !pairs.data && <PairsSkeleton rows={6} />}
            {pairs.data && pairs.data.length === 0 && (
              <p className="py-6 text-center font-body text-sm text-muted-foreground">
                No pairs with volume yet.
              </p>
            )}
            {pairs.data && pairs.data.length > 0 && (
              <div className="space-y-3">
                {pairs.data.map((pair, i) => (
                  <PairRow key={pair.pair} pair={pair} index={i} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Your trades — only when an address is active */}
      {address && (
        <Card
          className="glass mt-4 border-border/60 animate-fade-in-up"
          style={{ animationDelay: '200ms' }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                <History className="h-4 w-4 text-accent" />
              </div>
              <CardTitle className="font-display text-base font-bold">Your Nado Trades</CardTitle>
              <span className="ml-auto font-body text-xs text-muted-foreground">
                {formatAddress(address)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {userTrades.error && !userTrades.data && (
              <SectionError message={userTrades.error} onRetry={userTrades.refetch} />
            )}
            {userTrades.loading && !userTrades.data && <TradesSkeleton rows={4} />}
            {userTrades.data && userTrades.data.length === 0 && (
              <p className="py-6 text-center font-body text-sm text-muted-foreground">
                No Nado trades found for this address yet.
              </p>
            )}
            {userTrades.data && userTrades.data.length > 0 && (
              <div className="space-y-2">
                {userTrades.data.map((trade) => (
                  <TradeRow key={trade.digest} trade={trade} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function TradeRow({ trade }: { trade: NadoTrade }) {
  const isBuy = trade.side === 'Buy';
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 px-3 py-2.5 transition-colors hover:border-border/80">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            isBuy ? 'bg-emerald-500/10' : 'bg-red-500/10'
          )}
        >
          {isBuy ? (
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{trade.pair}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {formatAddress(trade.account)} · {formatPrice(trade.price)}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-sm font-semibold">{formatCompact(trade.amountUsd)}</p>
        <p className="text-xs text-muted-foreground">{timeAgo(trade.time)}</p>
      </div>
    </div>
  );
}

function PairRow({ pair, index }: { pair: NadoPair; index: number }) {
  const positive = pair.change >= 0;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 px-4 py-3 transition-all hover:scale-[1.01] hover:border-border/80">
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-display text-sm font-bold text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{pair.base}</p>
          <p className="truncate text-xs text-muted-foreground">
            {pair.openInterestUsd != null
              ? `OI ${formatCompact(pair.openInterestUsd)}`
              : `${pair.quote} · OI n/a`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="font-display text-sm font-semibold">{formatPrice(pair.price)}</p>
          <p className="text-xs text-muted-foreground">vol {formatCompact(pair.volume)}</p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}
        >
          {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {formatPercent(pair.change)}
        </span>
      </div>
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-rose-400/25 bg-rose-500/[0.05] px-4 py-8 text-center">
      <AlertTriangle className="mb-2 h-6 w-6 text-rose-300" />
      <p className="font-display text-sm font-semibold text-foreground/80">
        Couldn&apos;t load Nado data
      </p>
      <p className="mt-1 max-w-sm font-body text-xs leading-relaxed text-muted-foreground">
        {message}
      </p>
      <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        className="mt-3 gap-2 font-display transition-all hover:border-accent/50 hover:text-[#C8B5FF]"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  );
}

function TradesSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <Skeleton className="ml-auto h-3.5 w-16" />
            <Skeleton className="ml-auto h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PairsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <Skeleton className="ml-auto h-3.5 w-20" />
            <Skeleton className="ml-auto h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}
