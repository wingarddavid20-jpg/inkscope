import { fetchTydroOverview } from '@/lib/tydro';
import { fetchNadoTotalOpenInterestUsd, getNadoTickers } from '@/lib/nado';
import ecosystemData from '@/data/ecosystem.json';

// ─────────────────────────────────────────────────────────────────────────────
// Ink Ecosystem service — DefiLlama detail endpoint (user-approved 2026-08-27).
//
//   - TVL for Tydro, Veda, Sentora, Velodrome, Uniswap V4, Curve, Morpho Blue
//     → DefiLlama /protocol/{slug}: `chainTvls.Ink.tvl` is a TIME SERIES of
//     {date, totalLiquidityUSD} points; the LATEST entry's totalLiquidityUSD
//     is the current TVL. (The /protocols list endpoint does NOT expose
//     chainTvls.Ink.tvl — verified 2026-08-27 — so detail is the source.)
//   - Nado → indexer tickers (lib/nado.ts) for the product list + 24h volume;
//     TVL = Σ open interest across ALL pairs (on-chain Querier, USD).
//   - Tydro borrows → live RPC (fetchTydroOverview) as a secondary metric.
//
// Every protocol resolves independently: a missing chainTvls.Ink (or an empty
// series) yields null for that row's numbers — rendered as "N/A", never a
// fabricated value. Logo/URL come from the DefiLlama detail payload.
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

type DlTvlPoint = {
  date?: number;
  totalLiquidityUSD?: number | null;
};

type DlDetail = {
  slug?: string;
  name?: string;
  url?: string | null;
  logo?: string | null;
  chainTvls?: Record<
    string,
    { tvl?: DlTvlPoint[] | number | null; change_1d?: number | null } | null
  > | null;
};

const DL_CACHE_MS = 10 * 60_000;
// Detail payloads are small (100-500 KB) but DefiLlama can be slow under load;
// 6s gives headroom while keeping the whole parallel ecosystem call under the
// MCP tool budget (8s, lib/mcp-server.ts).
const DL_ABORT_MS = 6_000;

const dlDetailCache = new Map<string, { data: DlDetail; at: number }>();

/** One DefiLlama protocol detail payload, cached ~10 min; null on failure. */
async function fetchDlDetail(slug: string): Promise<DlDetail | null> {
  const cached = dlDetailCache.get(slug);
  if (cached && Date.now() - cached.at < DL_CACHE_MS) return cached.data;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DL_ABORT_MS);
  try {
    const res = await fetch(`https://api.llama.fi/protocol/${slug}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DlDetail;
    dlDetailCache.set(slug, { data, at: Date.now() });
    return data;
  } catch (err) {
    console.warn(`DefiLlama detail fetch failed for ${slug}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Current Ink TVL in USD from a DefiLlama detail payload. chainTvls.Ink.tvl is
 * a time series of {date, totalLiquidityUSD} — the LATEST entry is the current
 * value. Missing chainTvls.Ink, an empty series, or a non-series value all
 * degrade to null → the UI shows "N/A".
 */
function inkTvlUsd(detail: DlDetail | null): number | null {
  const ink = detail?.chainTvls?.Ink;
  if (!ink) return null;
  const tvl = ink.tvl;
  if (Array.isArray(tvl)) {
    if (tvl.length === 0) return null;
    return finiteOrNull(tvl[tvl.length - 1]?.totalLiquidityUSD);
  }
  return finiteOrNull(typeof tvl === 'number' ? tvl : null);
}

/**
 * Approximate 1-day TVL change %: the latest snapshot vs the snapshot nearest
 * 24h earlier. Null when the series has <2 points or the math is impossible.
 */
function inkChange1d(detail: DlDetail | null): number | null {
  const tvl = detail?.chainTvls?.Ink?.tvl;
  if (!Array.isArray(tvl) || tvl.length < 2) return null;
  const last = tvl[tvl.length - 1];
  const lastUsd = finiteOrNull(last?.totalLiquidityUSD);
  const lastDate = typeof last?.date === 'number' ? last.date : Date.now() / 1000;
  if (lastUsd == null) return null;

  const target = lastDate - 86_400;
  let best = tvl[0];
  for (const point of tvl) {
    if (typeof point?.date !== 'number') continue;
    if (Math.abs(point.date - target) < Math.abs((best?.date ?? Infinity) - target)) {
      best = point;
    }
  }
  const prevUsd = finiteOrNull(best?.totalLiquidityUSD);
  if (prevUsd == null || prevUsd === 0) return null;
  return ((lastUsd - prevUsd) / prevUsd) * 100;
}

export async function fetchEcosystemOverview(): Promise<EcosystemOverview> {
  const registry = ecosystemData.protocols as RegistryEntry[];

  const [tydro, nadoOiUsd, tickers, dlDetails] = await Promise.all([
    // Tydro borrows (secondary metric) only — TVL now comes from DefiLlama.
    fetchTydroOverview().catch(() => null),
    // Nado TVL = Σ open interest across all pairs.
    fetchNadoTotalOpenInterestUsd().catch(() => null),
    // Nado 24h quote volume from the indexer tickers.
    getNadoTickers().catch(() => null),
    // One detail payload per DefiLlama-registered protocol, in registry order.
    Promise.all(
      registry.map((entry) =>
        entry.source === 'defillama' ? fetchDlDetail(entry.slugs[0]) : Promise.resolve(null)
      )
    ),
  ]);

  const protocols: EcosystemProtocol[] = [];
  let tvlSum = 0;
  let tvlCount = 0;

  registry.forEach((entry, index) => {
    const dl = dlDetails[index];

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

    if (entry.source === 'indexer') {
      // Nado: TVL = total open interest (all pairs, on-chain Querier in USD).
      base.tvlUsd = nadoOiUsd;
      if (tickers) {
        let volume = 0;
        tickers.forEach((t) => {
          volume += t.volume;
        });
        base.volume24hUsd = volume;
      }
    } else if (entry.source === 'defillama') {
      base.tvlUsd = inkTvlUsd(dl);
      base.change24h = inkChange1d(dl);
      if (entry.id === 'tydro' && tydro) {
        base.borrowsUsd = tydro.totalBorrowUsd;
      }
    }

    if (base.tvlUsd != null) {
      tvlSum += base.tvlUsd;
      tvlCount += 1;
    }
    protocols.push(base);
  });

  return {
    protocols,
    totalTvlUsd: tvlCount > 0 ? tvlSum : null,
    updatedAt: new Date().toISOString(),
  };
}
