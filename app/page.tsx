'use client';

import { Header } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { MetricGrid } from '@/components/metric-card';
import { BuilderSpotlight } from '@/components/builder-spotlight';
import { NadoPanel } from '@/components/nado-panel';
import { TydroPanel } from '@/components/tydro-panel';
import { EcosystemPanel } from '@/components/ecosystem-panel';
import { LiquidityFlow } from '@/components/liquidity-flow';
import { TrendingNfts } from '@/components/trending-nfts';
import { DexHub } from '@/components/dex-hub';
import { useKeyMetrics } from '@/hooks/use-key-metrics';
import { useWallet } from '@/hooks/use-wallet';

export default function Home() {
  const { address, connected, connect, disconnect } = useWallet();
  const { metrics } = useKeyMetrics();

  return (
    <div className="grain-bg min-h-screen bg-background">
      <Header
        connected={connected}
        address={address}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 2xl:px-12">
        {/* Hero / intro */}
        <section id="dashboard" className="mb-10 scroll-mt-20">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]" />
            <span className="font-display text-xs font-medium uppercase tracking-wider text-[#B99CFF]">
              Live · Ink Mainnet
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            The Ink Ecosystem Dashboard
          </h1>
          <p className="mt-3 max-w-2xl font-body text-lg text-muted-foreground">
            Real-time on-chain analytics for Ink — track Tydro lending, Nado
            perpetuals, and ecosystem liquidity flows.
          </p>
        </section>

        {/* Key metrics — live on-chain */}
        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-bold accent-line">Key Metrics</h2>
          </div>
          <MetricGrid metrics={metrics} />
        </section>

        {/* Ink Ecosystem — live TVL & volume across top protocols */}
        <section className="mb-12">
          <EcosystemPanel />
        </section>

        {/* Liquidity Flow — bridge & CEX capital movements */}
        <section className="mb-12">
          <LiquidityFlow />
        </section>

        {/* Trending NFTs — top collections on Ink */}
        <section className="mb-12">
          <TrendingNfts />
        </section>

        {/* DEX Hub — where to trade on Ink */}
        <section className="mb-12">
          <DexHub />
        </section>

        {/* Live protocol panels — Nado (perps) + Tydro (lending) */}
        <div className="mb-12 space-y-12">
          <NadoPanel address={address} isOwner={!!address} />
          <TydroPanel address={address} />
        </div>

        {/* Builders */}
        <div className="mb-12">
          <BuilderSpotlight />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
