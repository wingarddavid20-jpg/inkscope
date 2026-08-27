'use client';

import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Droplets,
  ArrowUpRight,
  ArrowDownRight,
  Radar,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCompact, formatAddress } from '@/lib/format';
import { useTydroPanelData } from '@/hooks/use-tydro-subgraph';
import type { TydroOverview, TydroReserve } from '@/lib/tydro';
import type { TydroRiskPosition, TydroLeader } from '@/lib/queries/tydro';

export function TydroPanel() {
  const {
    data,
    source,
    loading,
    error,
    refetch,
    positions,
    suppliers,
    borrowers,
    positionsError,
  } = useTydroPanelData();

  return (
    <section id="tydro" className="scroll-mt-20">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
          <Droplets className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">Tydro</h2>
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-400/30 bg-emerald-400/10 font-display text-[10px] text-emerald-300"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live · Ink Mainnet
            </Badge>
            <span className="font-body text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {source === 'subgraph' ? 'via subgraph' : 'via RPC'}
            </span>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Lending protocol — on-chain health, risk &amp; utilization
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

      {error && !data && <ErrorCard message={error} onRetry={refetch} />}

      {!data && !error && <PanelSkeleton />}

      {data && (
        <TydroBody
          overview={data}
          source={source}
          positions={positions}
          suppliers={suppliers}
          borrowers={borrowers}
          positionsError={positionsError}
        />
      )}
    </section>
  );
}

/** The data section: banner + reserve utilization + risk + leaderboards. */
function TydroBody({
  overview,
  source,
  positions,
  suppliers,
  borrowers,
  positionsError,
}: {
  overview: TydroOverview;
  source: 'subgraph' | 'rpc';
  positions: TydroRiskPosition[] | null;
  suppliers: TydroLeader[] | null;
  borrowers: TydroLeader[] | null;
  positionsError: string | null;
}) {
  const rpcFallback = source === 'rpc';

  return (
    <>
      <OverviewBanner overview={overview} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Reserve utilization */}
        <Card className="glass border-border/60 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <CardTitle className="font-display text-base font-bold">
                Reserve Utilization
              </CardTitle>
              <span className="ml-auto font-body text-xs text-muted-foreground">
                Updated {new Date(overview.updatedAt).toLocaleTimeString()}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {overview.reserves.length === 0 ? (
              <p className="py-6 text-center font-body text-sm text-muted-foreground">
                No active reserves found.
              </p>
            ) : (
              <div className="space-y-4">
                {overview.reserves.map((reserve) => (
                  <ReserveRow key={reserve.address} reserve={reserve} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* High-risk positions */}
        <Card className="glass border-border/60 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <CardTitle className="font-display text-base font-bold">
                High-Risk Positions
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {positions && positions.length > 0 ? (
              <div className="divide-y divide-border/40">
                {positions.map((position) => (
                  <RiskRow key={position.address} position={position} />
                ))}
              </div>
            ) : (
              <IndexerPlaceholder
                title={
                  rpcFallback
                    ? 'Position indexer on standby'
                    : positionsError
                      ? 'Position indexer unavailable'
                      : 'No high-risk positions right now'
                }
                detail={
                  rpcFallback
                    ? 'Reserves are streaming from RPC while the Tydro subgraph catches up — at-risk accounts appear here automatically once it indexes positions.'
                    : positionsError ??
                      'Users with a health factor below 1.5 will appear here as soon as the subgraph indexes positions.'
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top suppliers / borrowers */}
      <Card className="glass mt-4 border-border/60 animate-fade-in-up" style={{ animationDelay: '220ms' }}>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base font-bold accent-line">
            Top Suppliers &amp; Borrowers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="suppliers">
            <TabsList className="mb-4 bg-secondary/60">
              <TabsTrigger value="suppliers" className="font-display text-sm gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                Suppliers
              </TabsTrigger>
              <TabsTrigger value="borrowers" className="font-display text-sm gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                Borrowers
              </TabsTrigger>
            </TabsList>
            <TabsContent value="suppliers">
              {suppliers && suppliers.length > 0 ? (
                <LeaderList leaders={suppliers} accent="emerald" />
              ) : (
                <LeaderPlaceholder
                  rpcFallback={rpcFallback}
                  positionsError={positionsError}
                  label="suppliers"
                />
              )}
            </TabsContent>
            <TabsContent value="borrowers">
              {borrowers && borrowers.length > 0 ? (
                <LeaderList leaders={borrowers} accent="rose" />
              ) : (
                <LeaderPlaceholder
                  rpcFallback={rpcFallback}
                  positionsError={positionsError}
                  label="borrowers"
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}

/** Real protocol-level aggregates pulled straight from the Pool. */
function OverviewBanner({ overview }: { overview: TydroOverview }) {
  const util = overview.utilization;
  const status =
    util < 70
      ? { label: 'Healthy', color: 'text-emerald-400' }
      : util < 85
        ? { label: 'Elevated', color: 'text-amber-400' }
        : { label: 'Tight', color: 'text-red-400' };

  return (
    <Card className="glass mb-4 border-border/60 p-5 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Supplied (TVL)
            </p>
            <p className="font-display text-3xl font-bold">{formatCompact(overview.tvlUsd)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:border-l sm:border-border/40 sm:pl-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10">
            <ArrowDownRight className="h-6 w-6 text-rose-400" />
          </div>
          <div>
            <p className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Borrows
            </p>
            <p className="font-display text-3xl font-bold">{formatCompact(overview.totalBorrowUsd)}</p>
          </div>
        </div>
        <div className="sm:pl-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Utilization
            </span>
            <span className={cn('font-display font-semibold', status.color)}>{status.label}</span>
          </div>
          <p className="mb-2 font-display text-2xl font-bold">{util.toFixed(1)}%</p>
          <Progress
            value={Math.min(util, 100)}
            className={cn(
              'h-2 bg-secondary',
              util >= 85 && '[&>div]:bg-red-500',
              util >= 70 && util < 85 && '[&>div]:bg-amber-500'
            )}
          />
          <p className="mt-1.5 font-body text-xs text-muted-foreground">
            {formatCompact(overview.availableUsd)} available liquidity
          </p>
        </div>
      </div>
    </Card>
  );
}

function ReserveRow({ reserve }: { reserve: TydroReserve }) {
  const util = reserve.utilization;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary font-display text-xs font-bold">
            {reserve.symbol.slice(0, 2)}
          </span>
          <span className="font-display text-sm font-semibold">{reserve.symbol}</span>
          <span className="text-xs text-muted-foreground">{reserve.supplyApy.toFixed(2)}% APY</span>
        </div>
        <span className="font-display text-sm font-semibold text-accent">
          {util.toFixed(1)}%
        </span>
      </div>
      <Progress
        value={Math.min(util, 100)}
        className={cn(
          'h-1.5 bg-secondary',
          util >= 85 && '[&>div]:bg-red-500',
          util >= 70 && util < 85 && '[&>div]:bg-amber-500'
        )}
      />
      <div className="mt-1 flex items-center justify-between font-body text-xs text-muted-foreground">
        <span>supplied {formatCompact(reserve.suppliedUsd)}</span>
        <span>borrowed {formatCompact(reserve.borrowedUsd)}</span>
      </div>
    </div>
  );
}

function RiskRow({ position }: { position: TydroRiskPosition }) {
  const hf = position.healthFactor;
  const tone =
    hf < 1
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
      : hf < 1.1
        ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
        : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300';
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold">
          {formatAddress(position.address)}
        </p>
        <p className="font-body text-xs text-muted-foreground">
          {formatCompact(position.collateralUsd)} collateral · {formatCompact(position.debtUsd)} debt
        </p>
      </div>
      <Badge variant="outline" className={cn('shrink-0 font-display text-[10px]', tone)}>
        HF {hf.toFixed(2)}
      </Badge>
    </div>
  );
}

function LeaderList({
  leaders,
  accent,
}: {
  leaders: TydroLeader[];
  accent?: 'emerald' | 'rose';
}) {
  return (
    <div className="divide-y divide-border/40">
      {leaders.map((leader, index) => (
        <div key={leader.address} className="flex items-center justify-between gap-2 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-secondary font-display text-[10px] font-bold text-muted-foreground">
              {index + 1}
            </span>
            <span className="truncate font-display text-sm font-semibold">
              {formatAddress(leader.address)}
            </span>
          </div>
          <span
            className={cn(
              'shrink-0 font-display text-sm font-semibold',
              accent === 'emerald'
                ? 'text-emerald-400'
                : accent === 'rose'
                  ? 'text-rose-400'
                  : 'text-accent'
            )}
          >
            {formatCompact(leader.balanceUsd)}
          </span>
        </div>
      ))}
    </div>
  );
}

function LeaderPlaceholder({
  rpcFallback,
  positionsError,
  label,
}: {
  rpcFallback: boolean;
  positionsError: string | null;
  label: string;
}) {
  return (
    <IndexerPlaceholder
      compact
      title={
        rpcFallback
          ? 'Leaderboard on standby'
          : positionsError
            ? 'Leaderboard unavailable'
            : `No ${label} yet`
      }
      detail={
        rpcFallback
          ? 'Top accounts appear here once the Tydro subgraph indexes positions.'
          : positionsError ??
            `The top ${label} table will populate as soon as the subgraph has position data.`
      }
    />
  );
}

function IndexerPlaceholder({
  title,
  detail,
  compact,
}: {
  title: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-secondary/20 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12'
      )}
    >
      <div className="relative mb-3">
        <Radar className="h-8 w-8 text-[#B99CFF]/60" />
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#8B5CF6]/10" />
      </div>
      <p className="font-display text-sm font-semibold text-foreground/80">{title}</p>
      <p className="mt-1.5 max-w-sm font-body text-xs leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="glass mb-4 border-rose-400/30 bg-rose-500/[0.04] p-8 text-center animate-fade-in-up">
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-rose-300" />
      <p className="font-display text-base font-bold">Couldn&apos;t load Tydro data</p>
      <p className="mx-auto mt-1 max-w-md font-body text-sm text-muted-foreground">{message}</p>
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

function PanelSkeleton() {
  return (
    <>
      <Card className="glass mb-4 border-border/60 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-center">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="glass border-border/60">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
