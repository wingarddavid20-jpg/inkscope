'use client';

import { useRouter } from 'next/navigation';
import { Header } from '@/components/site-header';
import { BuilderSpotlight } from '@/components/builder-spotlight';
import { SiteFooter } from '@/components/site-footer';
import { useWallet } from '@/hooks/use-wallet';

/**
 * Standalone /builders route — the same BuilderSpotlight content (community
 * spotlight, launch CTA) presented as a full page instead of a nav-scrolled
 * section. View buttons (InkBoard / My Dashboard) route back to the home
 * page, where those views live.
 */
export function BuildersPage() {
  const { address, connected, connect, disconnect } = useWallet();
  const router = useRouter();

  return (
    <div className="grain-bg min-h-screen bg-background">
      <Header
        connected={connected}
        address={address}
        onConnect={connect}
        onDisconnect={disconnect}
        view="dashboard"
        onViewChange={() => router.push('/')}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 2xl:px-12">
        {/* Page hero — mirrors the home hero styling */}
        <section className="mb-10 scroll-mt-20">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]" />
            <span className="font-display text-xs font-medium uppercase tracking-wider text-[#B99CFF]">
              Community · Ink Mainnet
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Builders<span className="text-[#A78BFA]">.</span>
          </h1>
          <p className="mt-3 max-w-2xl font-body text-lg text-muted-foreground">
            Proof of work from the Ink community — the builders shipping apps,
            protocols, and infrastructure on Ink.
          </p>
        </section>

        <div className="mb-12">
          <BuilderSpotlight />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
