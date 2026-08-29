'use client';

import { Header } from '@/components/site-header';
import { EcosystemPanel } from '@/components/ecosystem-panel';
import { SiteFooter } from '@/components/site-footer';
import { useWallet } from '@/hooks/use-wallet';

/**
 * Standalone /ecosystem route — the same live EcosystemPanel (protocol list,
 * TVL, 24h volume) presented as a full page. Nav items are real links with
 * pathname-based active highlighting (see site-header.tsx).
 */
export function EcosystemPage() {
  const { address, connected, connect, disconnect } = useWallet();

  return (
    <div className="grain-bg min-h-screen bg-background">
      <Header
        connected={connected}
        address={address}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 2xl:px-12">
        {/* Page hero — mirrors the home hero styling */}
        <section className="mb-10 scroll-mt-20">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]" />
            <span className="font-display text-xs font-medium uppercase tracking-wider text-[#B99CFF]">
              Live · Ink Mainnet
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Ink Ecosystem<span className="text-[#A78BFA]">.</span>
          </h1>
          <p className="mt-3 max-w-2xl font-body text-lg text-muted-foreground">
            TVL &amp; 24h volume across the top protocols building on Ink — Tydro lending,
            Nado perps, and the wider ecosystem.
          </p>
        </section>

        <div className="mb-12">
          <EcosystemPanel />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
