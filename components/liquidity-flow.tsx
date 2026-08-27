'use client';

import { ArrowDownRight, ArrowUpRight, Coins, Landmark, Route, WalletCards } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCompact } from '@/lib/format';

const bridgeFlow = { inbound: 18_600_000, outbound: 11_200_000 };
const cexFlow = { deposits: 7_400_000, withdrawals: 9_100_000 };

function FlowCard({
  label,
  value,
  direction,
  detail,
  icon,
}: {
  label: string;
  value: number;
  direction: 'in' | 'out';
  detail: string;
  icon: React.ReactNode;
}) {
  const entering = direction === 'in';
  return (
    <Card className="metric-card glass relative overflow-hidden border-border/60 p-5">
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${entering ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`} />
      <div className="relative flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${entering ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
          {icon}
        </div>
        <span className={`flex items-center gap-1 rounded-full px-2 py-1 font-display text-[11px] font-semibold ${entering ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
          {entering ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {entering ? 'Entering' : 'Leaving'} Ink
        </span>
      </div>
      <p className="relative mt-5 font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="relative mt-1 font-display text-2xl font-bold tracking-tight">{formatCompact(value)}</p>
      <p className="relative mt-2 font-body text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

function NetFlowCard({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: React.ReactNode }) {
  const entering = value >= 0;
  return (
    <Card className="glass relative overflow-hidden border-[#8B5CF6]/35 bg-[#8B5CF6]/[0.06] p-5 shadow-[0_0_32px_rgba(139,92,246,0.08)]">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#8B5CF6]" />
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6]/15 text-[#B99CFF]">{icon}</div>
        <span className="rounded-full bg-[#8B5CF6]/15 px-2 py-1 font-display text-[11px] font-semibold text-[#C8B5FF]">Net flow</span>
      </div>
      <p className="mt-5 font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${entering ? 'text-emerald-300' : 'text-rose-300'}`}>
        {value >= 0 ? '+' : '-'}{formatCompact(Math.abs(value))}
      </p>
      <p className="mt-2 font-body text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

export function LiquidityFlow() {
  const netBridge = bridgeFlow.inbound - bridgeFlow.outbound;
  const netCex = cexFlow.deposits - cexFlow.withdrawals;

  return (
    <section id="liquidity-flow" className="scroll-mt-24 mb-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]" />
            <span className="font-display text-xs font-medium uppercase tracking-wider text-[#B99CFF]">Capital movement · 24h</span>
            <Badge variant="outline" className="border-accent/30 bg-accent/10 font-display text-[10px] text-[#C8B5FF]">
              📊 Live Data Coming Soon
            </Badge>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Ink Liquidity Flow</h2>
          <p className="mt-2 max-w-xl font-body text-sm text-muted-foreground">See what is flowing into Ink, what is leaving, and where the liquidity is moving next.</p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 py-1.5 font-display text-xs text-[#C8B5FF] sm:flex">
          <Route className="h-3.5 w-3.5" />
          Bridge + CEX
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FlowCard label="Inbound Bridge Volume" value={bridgeFlow.inbound} direction="in" detail="Ethereum · Arbitrum · Base" icon={<ArrowUpRight className="h-5 w-5" />} />
        <FlowCard label="Outbound Bridge Volume" value={bridgeFlow.outbound} direction="out" detail="Leaving Ink for other networks" icon={<ArrowDownRight className="h-5 w-5" />} />
        <NetFlowCard label="Net Bridge Flow" value={netBridge} detail="Net liquidity entering Ink" icon={<Route className="h-5 w-5" />} />
        <FlowCard label="CEX Deposits" value={cexFlow.deposits} direction="out" detail="Wallets sending to exchanges" icon={<Coins className="h-5 w-5" />} />
        <FlowCard label="CEX Withdrawals" value={cexFlow.withdrawals} direction="in" detail="Capital returning from exchanges" icon={<WalletCards className="h-5 w-5" />} />
        <NetFlowCard label="Net CEX Flow" value={netCex} detail="Net movement away from exchanges" icon={<Landmark className="h-5 w-5" />} />
      </div>
    </section>
  );
}
