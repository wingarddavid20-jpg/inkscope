'use client';

import { Header } from '@/components/site-header';
import { MyDashboard } from '@/components/my-dashboard';
import { SiteFooter } from '@/components/site-footer';
import { useWallet } from '@/hooks/use-wallet';

/**
 * Standalone /my-dashboard route — the wallet-scoped portfolio (Tydro
 * position, Nado trades) presented as a full page with its own URL, so nav
 * highlighting and deep-linking work exactly like the other pages.
 */
export function MyDashboardPage() {
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
      </main>

      <SiteFooter />
    </div>
  );
}
