import { fetchTydroOverview } from '@/lib/tydro';
import { getNadoTickers } from '@/lib/nado';
import ecosystemData from '@/data/ecosystem.json';

// ─────────────────────────────────────────────────────────────────────────────
// Ink Ecosystem service — HYBRID data source (user-approved 2026-08-27).
//
//   - Tydro  → live on-chain RPC (lib/tydro.ts → fetchTydroOverview)
//   - Nado   → live indexer tickers (lib/nado.ts → getNadoTickers, Σ 24h volume)
//   - Others → DefiLlama /protocols (10-min module cache), Ink chainTvls only
//
// Every protocol resolves independently: a failure in one source (or a protocol
// DefiLlama doesn't list on Ink) yields null for that row's numbers — never a
// fabricated value. Logo/URL come from DefiLlama when available.
// ─────────────────────────────────────────────────────────────────────────────

export type EcosystemSource = 'rpc' | 'indexer' | 'defillama';

export type EcosystemProtocol = {
  id: string;
  name: string;
  category: string;
  url: string | null;
  description: string;
  source: EcosystemSource;
  logo: string | null;
  tvlUsd: number | null;
  change24h: number | null;
  volume24hUsd: number | null;
  borrowsUsd: number | null;
};

export type EcosystemOverview = {
  protocols: EcosystemProtocol[];
  /** Sum of TVL across protocols reporting a number; null when none do. */
  totalTvlUsd: number | null;
  updatedAt: string;
};

type RegistryEntry = {
  id: string;
  name: string;
  slugs: string[];
  source: EcosystemSource;
  category: string;
  url: string | null;
  description: string;
};

type DlProtocol = {
  slug?: string | null;
  name?: string | null;
  url?: string | null;
  logo?: string | null;
  chainTvls?: Record<string, { tvl?: number | null; change_1d?: number | null } | null> | null;
};

const DL_PROTOCOLS_URL = 'https://api.llama.fi/protocols';
const DL_CACHE_MS = 10 * 60_000;

let dlCache: { data: DlProtocol[]; at: number } | null = null;

/** Full DefiLlama protocol list, cached ~10 min across callers; null on failure. */
async function fetchDlProtocols(): Promise<DlProtocol[] | null> {
  if (dlCache && Date.now() - dlCache.at < DL_CACHE_MS) return dlCache.data;
  // DefiLlama's /protocols payload is large (~10MB) and can be slow; abort at
  // 7s so a slow response degrades to N/A rows instead of failing the whole
  // ecosystem call (MCP tools run under an 8s budget).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const res = await fetch(DL_PROTOCOLS_URL, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as DlProtocol[];
    dlCache = { data, at: Date.now() };
    return data;
  } catch (err) {
    console.warn('DefiLlama protocols fetch failed:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Match a registry entry against the DefiLlama list by slug or exact name. */
function findDlProtocol(entry: RegistryEntry, protocols: DlProtocol[]): DlProtocol | null {
  const nameLower = entry.name.toLowerCase();
  return (
    protocols.find(
      (p) =>
        entry.slugs.some((slug) => p.slug?.toLowerCase() === slug.toLowerCase()) ||
        p.name?.toLowerCase() === nameLower
    ) ?? null
  );
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function fetchEcosystemOverview(): Promise<EcosystemOverview> {
  const registry = ecosystemData.protocols as RegistryEntry[];

  const [tydro, tickers, dlProtocols] = await Promise.all([
    fetchTydroOverview().catch(() => null),
    getNadoTickers().catch(() => null),
    fetchDlProtocols(),
  ]);

  const protocols: EcosystemProtocol[] = [];
  let tvlSum = 0;
  let tvlCount = 0;

  for (const entry of registry) {
    const dl = dlProtocols ? findDlProtocol(entry, dlProtocols) : null;

    const base: EcosystemProtocol = {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      url: dl?.url ?? null,
      description: entry.description,
      source: entry.source,
      logo: dl?.logo ?? null,
      tvlUsd: null,
      change24h: null,
      volume24hUsd: null,
      borrowsUsd: null,
    };

    if (entry.source === 'rpc') {
      if (tydro) {
        base.tvlUsd = tydro.tvlUsd;
        base.borrowsUsd = tydro.totalBorrowUsd;
      }
    } else if (entry.source === 'indexer') {
      if (tickers) {
        let volume = 0;
        tickers.forEach((t) => {
          volume += t.volume;
        });
        base.volume24hUsd = volume;
      }
    } else if (entry.source === 'defillama' && dl) {
      const ink = dl.chainTvls?.Ink;
      base.tvlUsd = finiteOrNull(ink?.tvl);
      base.change24h = finiteOrNull(ink?.change_1d);
    }

    if (base.tvlUsd != null) {
      tvlSum += base.tvlUsd;
      tvlCount += 1;
    }
    protocols.push(base);
  }

  return {
    protocols,
    totalTvlUsd: tvlCount > 0 ? tvlSum : null,
    updatedAt: new Date().toISOString(),
  };
}
