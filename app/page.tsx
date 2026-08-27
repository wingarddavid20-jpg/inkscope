'use client';

import { useState } from 'react';
import { Header, type View } from '@/components/site-header';
import { MetricGrid } from '@/components/metric-card';
import { BuilderSpotlight } from '@/components/builder-spotlight';
import { NadoPanel } from '@/components/nado-panel';
import { TydroPanel } from '@/components/tydro-panel';
import { MyDashboard } from '@/components/my-dashboard';
import { useKeyMetrics } from '@/hooks/use-key-metrics';
import { useWallet } from '@/hooks/use-wallet';

export default function Home() {
  const { address, connected, connect, disconnect } = useWallet();
  const { metrics } = useKeyMetrics();
  const [view, setView] = useState<View>('dashboard');

  return (
    <div className="grain-bg min-h-screen bg-background">
      <Header
        connected={connected}
        address={address}
        onConnect={connect}
        onDisconnect={disconnect}
        view={view}
        onViewChange={setView}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 2xl:px-12">
        {view === 'dashboard' ? (
          <>
            {/* Hero / intro */}
            <section id="dashboard" className="mb-10 scroll-mt-20">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]" />
                <span className="font-display text-xs font-medium uppercase tracking-wider text-[#B99CFF]">
                  Live · Ink Mainnet
                </span>
              </div>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                Your builder&apos;s space
                <span className="text-[#A78BFA]">.</span>
              </h1>
              <p className="mt-3 max-w-2xl font-body text-lg text-muted-foreground">
                On-chain analytics for the Ink blockchain — track Tydro &amp; Nado,
                monitor your positions, and celebrate proof of work from the community.
              </p>
            </section>

            {/* Key metrics — live on-chain */}
            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-bold accent-line">Key Metrics</h2>
              </div>
              <MetricGrid metrics={metrics} />
            </section>

            {/* Live protocol panels — Nado (perps) + Tydro (lending) */}
            <div className="mb-12 space-y-12">
              <NadoPanel address={address} />
              <TydroPanel />
            </div>

            {/* Builders */}
            <div className="mb-12">
              <BuilderSpotlight />
            </div>
          </>
        ) : (
          <>
            {/* My Dashboard view */}
            <section id="my-dashboard" className="mb-8 scroll-mt-20">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]" />
                <span className="font-display text-xs font-medium uppercase tracking-wider text-[#B99CFF]">
                  Wallet · Ink Mainnet
                </span>
              </div>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                My Dashboard
                <span className="text-[#A78BFA]">.</span>
              </h1>
              <p className="mt-3 max-w-2xl font-body text-lg text-muted-foreground">
                Your positions, LP pools, and portfolio — all in one place.
              </p>
            </section>

            <MyDashboard
              connected={connected}
              address={address}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          </>
        )}
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 2xl:px-12">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold">Ink</span>
              <span className="font-body text-sm text-muted-foreground">
                — builder dashboard
              </span>
            </div>
            <p className="font-body text-sm text-muted-foreground">
              Built by the community, for the community.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
