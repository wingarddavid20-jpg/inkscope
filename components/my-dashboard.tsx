'use client';

import { useState } from 'react';
import {
  Wallet,
  ShieldCheck,
  Droplets,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  ClipboardPaste,
  RefreshCw,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCompact } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTydroUserPosition } from '@/hooks/use-tydro';
import { TydroPanel } from '@/components/tydro-panel';
import { NadoPanel } from '@/components/nado-panel';

type MyDashboardProps = {
  connected: boolean;
  address: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function MyDashboard({ connected, address, onConnect, onDisconnect }: MyDashboardProps) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedAddress, setPastedAddress] = useState('');
  const [viewAddress, setViewAddress] = useState<string | null>(null);

  // Active address = connected wallet OR pasted read-only address
  const activeAddress = address || viewAddress;
  const isReadOnly = !connected && !!viewAddress;
  const hasAccess = connected || !!viewAddress;

  // Live Tydro position for the active address (idle when no address yet).
  const {
    data: tydroPosition,
    loading: positionLoading,
    error: positionError,
    refetch: refetchPosition,
  } = useTydroUserPosition(activeAddress, 45_000);

  const handlePasteSubmit = () => {
    const trimmed = pastedAddress.trim();
    // Basic Ethereum address validation
    if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setViewAddress(trimmed);
      setPasteMode(false);
      setPastedAddress('');
    } else {
      alert('Please enter a valid Ethereum address (0x followed by 40 hex characters).');
    }
  };

  const handleDisconnectAll = () => {
    setViewAddress(null);
    setPasteMode(false);
    setPastedAddress('');
    onDisconnect();
  };

  // ─── Not connected / no address pasted ─────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="space-y-4">
        {/* Toggle between connect and paste modes */}
        {!pasteMode ? (
          <Card className="glass border-border/60 p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#8B5CF6]/15">
              <Wallet className="h-8 w-8 text-[#B99CFF]" />
            </div>
            <h3 className="font-display text-xl font-bold">View Your Dashboard</h3>
            <p className="mx-auto mt-2 max-w-sm font-body text-sm text-muted-foreground">
              Connect your wallet or paste an address to view Tydro positions, LP pools, and portfolio across Ink.
            </p>

            {/* Two action buttons */}
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                onClick={onConnect}
                className="gap-2 bg-[#7337F2] font-display text-white transition-all hover:scale-105 hover:bg-[#7337F2]/90 active:scale-95"
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
              <Button
                onClick={() => setPasteMode(true)}
                variant="outline"
                className="gap-2 font-display transition-all hover:border-[#8B5CF6]/60 hover:text-[#C8B5FF]"
              >
                <ClipboardPaste className="h-4 w-4" />
                Paste Wallet Address
              </Button>
            </div>

            <p className="mt-4 font-body text-xs text-muted-foreground">
              🔒 Paste mode is read-only — no signing required
            </p>
          </Card>
        ) : (
          /* Paste address input card */
          <Card className="glass border-[#8B5CF6]/30 bg-[#8B5CF6]/[0.04] p-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="h-5 w-5 text-[#B99CFF]" />
                <h3 className="font-display text-lg font-bold">Paste a Wallet Address</h3>
              </div>
              <button
                onClick={() => { setPasteMode(false); setPastedAddress(''); }}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 font-body text-sm text-muted-foreground">
              Enter any Ethereum wallet address to view its Ink positions in read-only mode. No wallet connection needed.
            </p>
            <div className="flex gap-2">
              <Input
                value={pastedAddress}
                onChange={(e) => setPastedAddress(e.target.value)}
                placeholder="0x..."
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handlePasteSubmit()}
                autoFocus
              />
              <Button
                onClick={handlePasteSubmit}
                disabled={!pastedAddress.trim()}
                className="shrink-0 bg-[#7337F2] font-display text-white hover:bg-[#7337F2]/90"
              >
                View
              </Button>
            </div>
            <p className="mt-3 font-body text-xs text-muted-foreground">
              🔒 Read-only — you cannot sign transactions in paste mode
            </p>
          </Card>
        )}
      </div>
    );
  }

  // ─── Connected or read-only address active ──────────────────────────────────
  const healthFactor = tydroPosition ? tydroPosition.healthFactor : null;
  const collateral = tydroPosition?.totalCollateralUsd ?? 12_500;
  const debt = tydroPosition?.totalDebtUsd ?? 5_200;
  const lpValue = 8_700; // LP positions (Nado/Asteroid) — demo until indexer is wired
  const lpCount = 4;
  const totalValue = collateral + lpValue;
  const healthPercent = healthFactor
    ? Math.min((Math.min(healthFactor, 4) / 4) * 100, 100)
    : 0;
  const positionStatus = !healthFactor
    ? { label: 'Loading…', color: 'text-muted-foreground' }
    : !Number.isFinite(healthFactor)
      ? { label: 'No debt · Safe', color: 'text-emerald-300' }
      : healthFactor >= 1.5
        ? { label: 'Safe · above liquidation', color: 'text-emerald-300' }
        : healthFactor >= 1.1
          ? { label: 'Elevated risk', color: 'text-amber-300' }
          : { label: 'Near liquidation', color: 'text-rose-300' };

  return (
    <div className="space-y-4">
      {/* Wallet banner */}
      <Card className="glass border-[#8B5CF6]/30 bg-[#8B5CF6]/[0.05] p-5 animate-fade-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border-2 border-[#8B5CF6]/40">
              <AvatarFallback className="bg-[#8B5CF6]/15 font-display text-sm font-bold text-[#C8B5FF]">
                {activeAddress ? activeAddress.slice(2, 4).toUpperCase() : '0X'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-bold">
                  {activeAddress ? `${activeAddress.slice(0, 6)}…${activeAddress.slice(-4)}` : 'Connected'}
                </p>
                {isReadOnly && (
                  <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 font-display text-[10px] text-amber-300">
                    👁 Read-only
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-400/30 bg-emerald-400/10 font-display text-[10px] text-emerald-300"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live · On-chain
                </Badge>
              </div>
              <p className="font-body text-xs text-muted-foreground">
                {isReadOnly ? 'Viewing address · Ink Mainnet · Read-only mode' : 'Connected to Ink Mainnet · Live on-chain data'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleDisconnectAll}
            variant="outline"
            size="sm"
            className="gap-2 font-display transition-all hover:border-rose-400/40 hover:text-rose-300"
          >
            {isReadOnly ? 'Clear Address' : 'Disconnect'}
          </Button>
        </div>
      </Card>

      {/* Portfolio overview cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Tydro position summary — live on-chain */}
        <Card className="glass border-border/60 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
              </div>
              <CardTitle className="font-display text-base font-bold">Tydro Position</CardTitle>
              {positionLoading && (
                <Badge variant="outline" className="ml-auto gap-1 font-display text-xs">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Loading
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {positionError && (
              <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2.5">
                <p className="font-body text-xs text-rose-300">{positionError}</p>
                <button
                  onClick={refetchPosition}
                  className="mt-1 font-display text-xs font-semibold text-rose-200 underline underline-offset-2 hover:text-rose-100"
                >
                  Retry
                </button>
              </div>
            )}

            {positionLoading && !tydroPosition && !positionError && (
              <div className="space-y-3">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-1.5 w-full" />
                <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            )}

            {!positionLoading && tydroPosition && !positionError && (
              <>
                <div>
                  <p className="font-display text-xs uppercase tracking-wider text-muted-foreground">Health Factor</p>
                  <p className="mt-1 font-display text-3xl font-bold text-emerald-300">
                    {Number.isFinite(tydroPosition.healthFactor)
                      ? tydroPosition.healthFactor.toFixed(2)
                      : '∞'}
                  </p>
                  <Progress value={healthPercent} className="mt-2 h-1.5 bg-secondary" />
                  <p className={cn('mt-1.5 font-body text-xs', positionStatus.color)}>
                    {positionStatus.label}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3">
                  <div>
                    <p className="flex items-center gap-1 font-display text-xs uppercase tracking-wider text-muted-foreground">
                      <ArrowUpRight className="h-3 w-3 text-emerald-300" />
                      Collateral
                    </p>
                    <p className="mt-1 font-display text-lg font-bold">{formatCompact(tydroPosition.totalCollateralUsd)}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 font-display text-xs uppercase tracking-wider text-muted-foreground">
                      <ArrowDownRight className="h-3 w-3 text-rose-300" />
                      Debt
                    </p>
                    <p className="mt-1 font-display text-lg font-bold">{formatCompact(tydroPosition.totalDebtUsd)}</p>
                  </div>
                </div>
              </>
            )}

            {!positionLoading && !positionError && !tydroPosition && (
              <p className="py-2 font-body text-sm text-muted-foreground">
                No active Tydro position for this address.
              </p>
            )}
          </CardContent>
        </Card>

        {/* LP positions */}
        <Card className="glass border-border/60 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6]/15">
                <Droplets className="h-4 w-4 text-[#B99CFF]" />
              </div>
              <CardTitle className="font-display text-base font-bold">LP Positions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-display text-xs uppercase tracking-wider text-muted-foreground">Total LP Value</p>
              <p className="mt-1 font-display text-3xl font-bold">{formatCompact(lpValue)}</p>
            </div>
            <div className="border-t border-border/40 pt-3">
              <p className="font-display text-xs uppercase tracking-wider text-muted-foreground">Active Positions</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 font-display text-xs">
                  <Layers className="h-3 w-3" />
                  {lpCount} pools
                </Badge>
                <span className="font-body text-xs text-muted-foreground">INK/USDC · INK/ETH · …</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio summary */}
        <Card className="glass relative overflow-hidden border-[#8B5CF6]/30 bg-[#8B5CF6]/[0.05] animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#8B5CF6]/15 blur-2xl" />
          <CardHeader className="relative pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6]/15">
                <PieChart className="h-4 w-4 text-[#B99CFF]" />
              </div>
              <CardTitle className="font-display text-base font-bold">Portfolio Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div>
              <p className="font-display text-xs uppercase tracking-wider text-muted-foreground">Total Value</p>
              <p className="mt-1 font-display text-3xl font-bold text-[#C8B5FF]">{formatCompact(totalValue)}</p>
            </div>
            <div className="space-y-2 border-t border-border/40 pt-3">
              <SummaryRow
                label="Collateral"
                value={tydroPosition ? tydroPosition.totalCollateralUsd : collateral}
              />
              <SummaryRow label="LP Value (demo)" value={lpValue} />
              <SummaryRow
                label="Debt"
                value={-(tydroPosition ? tydroPosition.totalDebtUsd : debt)}
                negative
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-[#8B5CF6]/10 px-3 py-2">
              <RefreshCw className={cn('h-3.5 w-3.5 text-[#B99CFF]', positionLoading && 'animate-spin')} />
              <span className="font-display text-xs font-medium text-[#C8B5FF]">
                Auto-refreshes live on-chain data
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tydro & Nado protocol tabs */}
      <div className="mt-2">
        <Tabs defaultValue="tydro">
          <div className="mb-4 flex items-center gap-3">
            <TabsList className="bg-secondary/60">
              <TabsTrigger value="tydro" className="gap-2 font-display text-sm">
                <ShieldCheck className="h-4 w-4" />
                Tydro
              </TabsTrigger>
              <TabsTrigger value="nado" className="gap-2 font-display text-sm">
                <Sparkles className="h-4 w-4" />
                Nado
              </TabsTrigger>
            </TabsList>
            <span className="font-body text-xs text-muted-foreground">Protocol deep-dive</span>
          </div>

          <TabsContent value="tydro" className="mt-0">
            <TydroPanel />
          </TabsContent>

          <TabsContent value="nado" className="mt-0">
            <NadoPanel address={activeAddress} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body text-sm text-muted-foreground">{label}</span>
      <span className={`font-display text-sm font-semibold ${negative ? 'text-rose-300' : 'text-foreground'}`}>
        {negative ? '-' : ''}{formatCompact(Math.abs(value))}
      </span>
    </div>
  );
}
