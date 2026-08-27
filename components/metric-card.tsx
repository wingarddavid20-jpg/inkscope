'use client';

import { TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCompact } from '@/lib/format';

export type Metric = {
  label: string;
  /** null = no data source yet → renders "N/A". */
  value: number | null;
  /** True while the first fetch is still in flight. */
  pending?: boolean;
  /** Where the value comes from, shown as the card footer. */
  source: string;
};

export function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  const value = metric.value;
  const hasValue = value !== null;

  return (
    <Card
      className="metric-card glass relative overflow-hidden border-border/60 p-5 animate-fade-in-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Accent corner glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <span className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {metric.label}
        </span>
        {hasValue ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        ) : (
          <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            Unavailable
          </span>
        )}
      </div>

      <div className="relative mt-3">
        {metric.pending && !hasValue ? (
          <Skeleton className="h-9 w-28" />
        ) : (
          <p
            className={cn(
              'font-display text-3xl font-bold tracking-tight',
              !hasValue && 'text-muted-foreground/70'
            )}
          >
            {hasValue ? formatCompact(value) : 'N/A'}
          </p>
        )}
      </div>

      <div className="relative mt-4 flex items-center gap-1.5 border-t border-border/40 pt-3">
        <TrendingUp className="h-3 w-3 text-muted-foreground" />
        <span className="font-body text-xs text-muted-foreground">{metric.source}</span>
      </div>
    </Card>
  );
}

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, i) => (
        <MetricCard key={metric.label} metric={metric} index={i} />
      ))}
    </div>
  );
}
