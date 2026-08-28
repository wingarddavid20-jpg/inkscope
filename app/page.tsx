'use client';

import { useState } from 'react';
import { Globe, Twitter, Github } from 'lucide-react';
import { Header, type View } from '@/components/site-header';
import { InkLogo } from '@/components/ink-logo';
import { MetricGrid } from '@/components/metric-card';
import { BuilderSpotlight } from '@/components/builder-spotlight';
import { NadoPanel } from '@/components/nado-panel';
import { TydroPanel } from '@/components/tydro-panel';
import { EcosystemPanel } from '@/components/ecosystem-panel';
import { LiquidityFlow } from '@/components/liquidity-flow';
import { TrendingNfts } from '@/components/trending-nfts';
import { DexHub } from '@/components/dex-hub';
import { MyDashboard } from '@/components/my-dashboard';
import { useKeyMetrics } from '@/hooks/use-key-metrics';
import { useWallet } from '@/hooks/use-wallet';

// lucide-react 0.446 has no brand "Discord" icon, so use the official mark inline
// (same pattern as InkLogo's inline SVG) to match the Globe/Twitter/Github icons.
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const socialLinks = [
  { label: 'Ink Website', href: 'https://inkonchain.com', icon: <Globe className="h-3.5 w-3.5" /> },
  { label: 'Ink Twitter', href: 'https://x.com/inkonchain', icon: <Twitter className="h-3.5 w-3.5" /> },
  { label: 'Ink Discord', href: 'https://discord.gg/inkonchain', icon: <DiscordIcon className="h-3.5 w-3.5" /> },
  { label: 'Ink GitHub', href: 'https://github.com/inkonchain', icon: <Github className="h-3.5 w-3.5" /> },
];

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
                Your Portfolio
                <span className="text-[#A78BFA]">.</span>
              </h1>
              <p className="mt-3 max-w-2xl font-body text-lg text-muted-foreground">
                Your Tydro position, Nado trades, and portfolio — wallet-scoped only.
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
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 2xl:px-12">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div className="flex items-center gap-2.5">
              <InkLogo />
              <div>
                <p className="font-display text-sm font-bold leading-tight">InkBoard</p>
                <p className="font-body text-xs text-muted-foreground">
                  The Ink ecosystem dashboard
                </p>
              </div>
            </div>

            <nav
              className="flex flex-wrap items-center justify-center gap-2"
              aria-label="Ink social links"
            >
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/30 px-3 py-1.5 font-body text-xs font-medium text-muted-foreground transition-colors hover:border-[#8B5CF6]/50 hover:text-[#C8B5FF]"
                >
                  {link.icon}
                  {link.label}
                </a>
              ))}
            </nav>

            <span className="flex items-center gap-1.5 rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-3.5 py-1.5 font-display text-xs font-semibold text-[#C8B5FF]">
              ⚡ Built on Ink
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
