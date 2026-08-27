'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { Metric } from '@/lib/mock-data';

type MetricCardProps = {
  metric: Metric;
  index: number;
};

function formatValue(value: number, label: string): string {
  if (label === 'Active Wallets') return formatNumber(value);
  return formatCompact(value);
}

export function MetricCard({ metric, index }: MetricCardProps) {
  const positive = metric.change >= 0;
  const [pulsing, setPulsing] = useState(false);

  // Simulate periodic data refresh pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsing(true);
      setTimeout(() => setPulsing(false), 800);
    }, 8000 + index * 1200);
    return () => clearInterval(interval);
  }, [index]);

  return (
    <Card
      className={cn(
        'metric-card glass relative overflow-hidden border-border/60 p-5 animate-fade-in-up',
        pulsing && 'animate-data-pulse'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Accent corner glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <span className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {metric.label}
        </span>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            positive
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {positive ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {formatPercent(metric.change)}
        </span>
      </div>

      <div className="relative mt-3">
        <p className="font-display text-3xl font-bold tracking-tight">
          {formatValue(metric.value, metric.label)}
        </p>
      </div>

      {/* Sparkline */}
      <div className="relative mt-4 h-10">
        <Sparkline data={metric.spark} positive={positive} />
      </div>
    </Card>
  );
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 36;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;
  const color = positive ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-5))';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${positive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-${positive ? 'up' : 'down'})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
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

export function MetricCardFooter({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <TrendingUp className="h-3 w-3" />
      {label}
    </div>
  );
}
