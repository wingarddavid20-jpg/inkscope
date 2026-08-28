'use client';

import type { ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Landmark,
  Radar,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCompact } from '@/lib/format';
import { useLiquidity } from '@/hooks/use-liquidity';

const WINDOW_LABEL = '24h rolling window';

/**
 * Liquidity Flow — bridge + CEX capital movements into/out of Ink.
 *
 * Data comes from the Goldsky subgraph (lib/liquidity.ts). When the endpoint
 * is unreachable or the deployed subgraph doesn't index bridge/CEX transfer
 * entities yet, the cards render "N/A" — never mock data.
 */
export function LiquidityFlow() {
  const { data, loading, error, unavailable, refetch } = useLiquidity();
  const showSkeleton = loading && !data;

  return (
    <section id="liquidity" className="scroll-mt-20">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
          <ArrowLeftRight className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">Liquidity Flow</h2>
            <Badge
              variant="outline"
              className="gap-1.5 border-[#8B5CF6]/30 bg-[#8B5CF6]/10 font-display text-[10px] text-[#B99CFF]"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#A78BFA]" />
              Live · Goldsky
            </Badge>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Bridge &amp; CEX capital movements into and out of Ink
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

      {/* Stale-data notice (transient poll failure with last payload on screen) */}
      {data && error && (
        <p className="mb-4 font-body text-xs text-amber-300/80">
          Couldn&apos;t refresh — showing last data. {error}
        </p>
      )}

      {showSkeleton ? (
        <FlowSkeleton />
      ) : (
        <>
          {!data && (
            <FlowStatusNote
              unavailable={unavailable}
              message={error ?? undefined}
              onRetry={refetch}
            />
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FlowCard
              title="Bridge Flow"
              icon={<ArrowLeftRight className="h-4 w-4 text-accent" />}
              rows={[
                { label: 'Inbound (entering Ink)', value: data?.inboundBridgeUsd },
                { label: 'Outbound (leaving Ink)', value: data?.outboundBridgeUsd },
              ]}
              netLabel="Net Bridge Flow"
              netValue={data?.netBridgeUsd}
              updatedAt={data?.updatedAt}
            />
            <FlowCard
              title="CEX Flow"
              icon={<Landmark className="h-4 w-4 text-accent" />}
              rows={[
                { label: 'CEX Deposits', value: data?.cexDepositsUsd },
                { label: 'CEX Withdrawals', value: data?.cexWithdrawalsUsd },
              ]}
              netLabel="Net CEX Flow"
              netValue={data?.netCexUsd}
              updatedAt={data?.updatedAt}
            />
          </div>
        </>
      )}
    </section>
  );
}

function FlowCard({
  title,
  icon,
  rows,
  netLabel,
  netValue,
  updatedAt,
}: {
  title: string;
  icon: ReactNode;
  rows: { label: string; value: number | undefined }[];
  netLabel: string;
  netValue: number | undefined;
  updatedAt: number | undefined;
}) {
  return (
    <Card className="glass border-border/60 animate-fade-in-up">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="font-display text-base font-bold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/40">
          {rows.map((row) => (
            <FlowRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 px-3 py-2.5">
          <span className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {netLabel}
          </span>
          {netValue === undefined ? (
            <span className="font-display text-lg font-bold text-muted-foreground/50">N/A</span>
          ) : (
            <NetValue value={netValue} />
          )}
        </div>

        <p className="mt-3 font-body text-xs text-muted-foreground">
          {WINDOW_LABEL} · via Goldsky
          {updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString()}` : ''}
        </p>
      </CardContent>
    </Card>
  );
}

function FlowRow({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5">
      <div className="flex items-center gap-2">
        {value === undefined ? (
          <span className="h-3.5 w-3.5 rounded-full border border-dashed border-border/60" />
        ) : label.toLowerCase().includes('inbound') || label.toLowerCase().includes('deposit') ? (
          <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
        )}
        <span className="font-body text-sm text-muted-foreground">{label}</span>
      </div>
      {value === undefined ? (
        <span className="font-display text-base font-semibold text-muted-foreground/50">N/A</span>
      ) : (
        <span className="font-display text-base font-semibold">{formatCompact(value)}</span>
      )}
    </div>
  );
}

function NetValue({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        'font-display text-lg font-bold',
        positive ? 'text-emerald-400' : 'text-rose-400'
      )}
    >
      {positive ? '+' : '−'}
      {formatCompact(Math.abs(value))}
    </span>
  );
}

/** Explains why the six metrics are N/A (never mock data). */
function FlowStatusNote({
  unavailable,
  message,
  onRetry,
}: {
  unavailable: boolean;
  message?: string;
  onRetry: () => void;
}) {
  const tone = unavailable ? 'amber' : 'rose';
  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-start gap-3 rounded-lg border px-3.5 py-3',
        tone === 'amber'
          ? 'border-amber-400/20 bg-amber-500/[0.06]'
          : 'border-rose-400/20 bg-rose-500/[0.06]'
      )}
    >
      <Radar
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          tone === 'amber' ? 'text-amber-300' : 'text-rose-300'
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-display text-sm font-semibold',
            tone === 'amber' ? 'text-amber-200' : 'text-rose-200'
          )}
        >
          {unavailable
            ? 'Flow indexer on standby'
            : "Couldn't reach the flow indexer"}
        </p>
        <p className="mt-0.5 font-body text-xs leading-relaxed text-muted-foreground">
          {unavailable
            ? 'This Goldsky subgraph does not index BridgeTransfer / CexTransfer entities yet. Metrics show N/A until a bridge & CEX flow subgraph is deployed to the same project — then this panel lights up automatically.'
            : `Metrics show N/A until the endpoint responds. ${message ?? ''}`}
        </p>
      </div>
      <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        className="gap-2 font-display transition-all hover:border-accent/50 hover:text-[#C8B5FF]"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}

function FlowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i} className="glass border-border/60">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1].map((j) => (
              <div key={j} className="flex items-center justify-between py-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-3 w-44" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
