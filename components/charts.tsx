'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { trendData, liquidityFlows, type TrendPoint } from '@/lib/mock-data';

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg border border-border/60 px-3 py-2 shadow-lg">
      <p className="mb-1 font-display text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="font-display text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: ${entry.value.toFixed(1)}{unit || 'M'}
        </p>
      ))}
    </div>
  );
}

export function TrendChart() {
  const [range, setRange] = useState<'7d' | '30d'>('7d');

  return (
    <Card className="glass border-border/60 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-display text-lg font-bold accent-line">
              Protocol Trends
            </CardTitle>
            <Badge variant="outline" className="border-accent/30 bg-accent/10 font-display text-[10px] text-[#C8B5FF]">
              📊 Live Data Coming Soon
            </Badge>
          </div>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            TVL &amp; 24h volume across Ink (Demo dataset)
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as '7d' | '30d')}>
          <TabsList className="bg-secondary/60">
            <TabsTrigger value="7d" className="font-display text-xs">7D</TabsTrigger>
            <TabsTrigger value="30d" className="font-display text-xs">30D</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
              <XAxis
                dataKey="day"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}M`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="tvl"
                name="TVL"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#tvlGrad)"
              />
              <Area
                type="monotone"
                dataKey="volume"
                name="Volume"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                fill="url(#volGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center gap-6 px-2">
          <LegendDot color="hsl(var(--chart-1))" label="TVL" />
          <LegendDot color="hsl(var(--chart-3))" label="24h Volume" />
        </div>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="font-display text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function LiquidityFlowChart() {
  const data = liquidityFlows.map((f) => ({
    name: f.protocol,
    Inflow: f.inflow,
    Outflow: f.outflow,
  }));

  return (
    <Card className="glass border-border/60 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-display text-lg font-bold accent-line">
            Liquidity Flows
          </CardTitle>
          <Badge variant="outline" className="border-accent/30 bg-accent/10 font-display text-[10px] text-[#C8B5FF]">
            📊 Live Data Coming Soon
          </Badge>
        </div>
        <p className="mt-2 font-body text-sm text-muted-foreground">
          Net capital movement by protocol ($M, 24h · Demo dataset)
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}M`}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                content={<ChartTooltip />}
              />
              <Bar dataKey="Inflow" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Outflow" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center gap-6 px-2">
          <LegendDot color="hsl(var(--chart-2))" label="Inflow" />
          <LegendDot color="hsl(var(--chart-5))" label="Outflow" />
        </div>
      </CardContent>
    </Card>
  );
}
