import { ethers } from 'ethers';
import nadoAddresses from '@/data/nado-addresses.json';

// ─────────────────────────────────────────────────────────────────────────────
// Nado service — real data for the Nado perps DEX on Ink (chain 57073).
//
// Nado matches orders off-chain and settles them through the Endpoint, so
// per-fill data (recent trades, trade history) is served by the official Nado
// indexer archive (see data/nado-addresses.json → indexer). Live market state —
// open interest per product — is read on-chain from the Querier contract via
// the Alchemy RPC endpoint, mirroring the lib/tydro.ts pattern.
//
// Numeric conventions (verified 2026-08-25):
//   - Indexer fill amounts (base_filled, quote_filled, priceX18) are X18
//     decimal strings; quote is USDT0 ≈ $1, so |quote_filled|/1e18 ≈ notional USD.
//   - Querier state.openInterest is X18 in BASE units; oraclePriceX18 is the
//     USD price, so OI_USD = openInterest/1e18 × oraclePrice/1e18.
//   - A fill's side: base_filled > 0 → Buy, < 0 → Sell.
//   - A subaccount is bytes32 = owner(20B) + name(12B); the default cross
//     margin subaccount name is "default" → 0x… + 64656661756c740000000000.
// ─────────────────────────────────────────────────────────────────────────────

const X18 = 1e18;

// ── Types ────────────────────────────────────────────────────────────────────

export type NadoTrade = {
  digest: string;
  productId: number;
  /** Base symbol, e.g. "BTC-PERP" or "WETH". */
  pair: string;
  quote: string;
  /** 'Buy' when the account bought base, 'Sell' when it sold. */
  side: 'Buy' | 'Sell';
  /** Notional in USD (|quote_filled|/1e18). */
  amountUsd: number;
  /** Executed price in quote units (quote_filled / base_filled). */
  price: number;
  /** Base size filled (|base_filled|/1e18). */
  size: number;
  /** Fill timestamp in ms. */
  time: number;
  /** Subaccount owner (wallet) behind the fill. */
  account: string;
};

export type NadoPair = {
  /** Full ticker id, e.g. "BTC-PERP_USDT0". */
  pair: string;
  base: string;
  quote: string;
  /** Last price in quote units (≈ USD). */
  price: number;
  /** 24h quote volume in USD. */
  volume: number;
  /** 24h price change in percent. */
  change: number;
  /** Open interest in USD, null when the on-chain call failed. */
  openInterestUsd: number | null;
  productId: number;
};

// ── Provider / contract accessors ────────────────────────────────────────────

let providerCache: ethers.JsonRpcProvider | null = null;

export function getNadoProvider(): ethers.JsonRpcProvider {
  if (providerCache) return providerCache;
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const url = apiKey
    ? `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`
    : nadoAddresses.rpcFallback;
  providerCache = new ethers.JsonRpcProvider(url, nadoAddresses.chainId, {
    staticNetwork: true,
  });
  return providerCache;
}

const querierAbi = [
  'function getPerpProducts(uint32[] productIds) view returns ((uint32 productId, int128 oraclePriceX18, (int128 longWeightInitialX18, int128 shortWeightInitialX18, int128 longWeightMaintenanceX18, int128 shortWeightMaintenanceX18, int128 priceX18) risk, (int128 cumulativeFundingLongX18, int128 cumulativeFundingShortX18, int128 availableSettle, int128 openInterest) state, (int128 sizeIncrement, int128 priceIncrementX18, int128 minSize, int128 collectedFees) bookInfo)[])',
] as const;

export function getNadoQuerier(provider: ethers.Provider = getNadoProvider()) {
  return new ethers.Contract(nadoAddresses.querier, querierAbi, provider);
}

// ── Indexer helpers ──────────────────────────────────────────────────────────

type IndexerMatch = {
  digest?: string;
  is_taker?: boolean;
  base_filled?: string;
  quote_filled?: string;
  submission_idx?: string;
  order?: { sender?: string };
  pre_balance?: {
    base?: {
      perp?: { product_id?: number | string };
      spot?: { product_id?: number | string };
    };
  };
};

type IndexerTx = { submission_idx?: string; timestamp?: string | number };

async function indexerFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.reason ?? json.message ?? text;
    } catch {
      // keep raw text
    }
    throw new Error(`Nado indexer ${res.status}: ${detail}`);
  }
  return text ? JSON.parse(text) : null;
}

function indexerPost(body: unknown): Promise<unknown> {
  return indexerFetch(nadoAddresses.indexer.v1, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type NadoTicker = {
  productId: number;
  tickerId: string;
  base: string;
  quote: string;
  price: number;
  volume: number;
  change: number;
};

let tickerCache: { data: Map<number, NadoTicker>; at: number } | null = null;

/** Latest market stats for every product, cached ~30s across callers. */
export async function getNadoTickers(force = false): Promise<Map<number, NadoTicker>> {
  if (!force && tickerCache && Date.now() - tickerCache.at < 30_000) {
    return tickerCache.data;
  }
  const raw = (await indexerFetch(`${nadoAddresses.indexer.v2}/tickers`)) as Record<
    string,
    {
      product_id: number;
      base_currency: string;
      quote_currency: string;
      last_price: number;
      quote_volume: number;
      price_change_percent_24h: number;
    }
  >;
  const map = new Map<number, NadoTicker>();
  for (const [tickerId, t] of Object.entries(raw ?? {})) {
    map.set(Number(t.product_id), {
      productId: Number(t.product_id),
      tickerId,
      base: t.base_currency,
      quote: t.quote_currency,
      price: Number(t.last_price),
      volume: Number(t.quote_volume),
      change: Number(t.price_change_percent_24h),
    });
  }
  tickerCache = { data: map, at: Date.now() };
  return map;
}

/** Default cross-margin subaccount for a wallet: owner + "default" (bytes12). */
export function getNadoDefaultSubaccount(address: string): string {
  return `${address.toLowerCase()}64656661756c740000000000`;
}

function parseMatches(
  raw: unknown,
  tickers: Map<number, NadoTicker>,
  opts: { onlyTakers: boolean; owner?: string }
): NadoTrade[] {
  const { matches = [], txs = [] } = (raw ?? {}) as { matches: IndexerMatch[]; txs: IndexerTx[] };
  const timeBySubmission = new Map<string, number>();
  for (const tx of txs) {
    if (tx.submission_idx != null && tx.timestamp != null) {
      timeBySubmission.set(String(tx.submission_idx), Number(tx.timestamp) * 1000);
    }
  }

  const trades: NadoTrade[] = [];
  for (const match of matches) {
    if (opts.onlyTakers && match.is_taker !== true) continue;

    const baseFilled = BigInt(match.base_filled ?? '0');
    const quoteFilled = BigInt(match.quote_filled ?? '0');
    if (baseFilled === BigInt('0') || quoteFilled === BigInt('0')) continue;

    const sender = match.order?.sender ?? '';
    const owner = sender.slice(0, 42);
    if (opts.owner && owner.toLowerCase() !== opts.owner.toLowerCase()) continue;

    const productId = Number(
      match.pre_balance?.base?.perp?.product_id ?? match.pre_balance?.base?.spot?.product_id ?? 0
    );
    const ticker = tickers.get(productId);
    const size = Math.abs(Number(baseFilled)) / X18;
    const notional = Math.abs(Number(quoteFilled)) / X18;

    trades.push({
      digest: match.digest ?? '',
      productId,
      pair: ticker?.base ?? `#${productId}`,
      quote: ticker?.quote ?? 'USDT0',
      side: baseFilled > BigInt('0') ? 'Buy' : 'Sell',
      amountUsd: notional,
      price: size > 0 ? notional / size : 0,
      size,
      time: timeBySubmission.get(String(match.submission_idx)) ?? Date.now(),
      account: owner || 'unknown',
    });
  }

  trades.sort((a, b) => b.time - a.time);
  return trades;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Latest taker fills across the DEX, newest first. */
export async function fetchNadoRecentTrades(limit = 8): Promise<NadoTrade[]> {
  const [raw, tickers] = await Promise.all([
    indexerPost({ matches: { limit, desc: true } }),
    getNadoTickers(),
  ]);
  return parseMatches(raw, tickers, { onlyTakers: true }).slice(0, limit);
}

/** Top pairs by 24h quote volume, with on-chain open interest in USD. */
export async function fetchNadoTopPairs(limit = 8): Promise<NadoPair[]> {
  const tickers = await getNadoTickers();
  const top = Array.from(tickers.values())
    .filter((t) => t.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);

  const openInterestUsd = await fetchOpenInterestUsd(top.map((t) => t.productId));

  return top.map((t) => ({
    pair: t.tickerId,
    base: t.base,
    quote: t.quote,
    price: t.price,
    volume: t.volume,
    change: t.change,
    openInterestUsd: openInterestUsd.get(t.productId) ?? null,
    productId: t.productId,
  }));
}

/** Trade history for a wallet's default subaccount, newest first. */
export async function fetchNadoUserTrades(address: string, limit = 10): Promise<NadoTrade[]> {
  const [raw, tickers] = await Promise.all([
    indexerPost({ matches: { subaccounts: [getNadoDefaultSubaccount(address)], limit, desc: true } }),
    getNadoTickers(),
  ]);
  return parseMatches(raw, tickers, { onlyTakers: false, owner: address }).slice(0, limit);
}

/** Open interest per product (USD). OI is X18 in BASE units × oracle USD price. */
async function fetchOpenInterestUsd(productIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (productIds.length === 0) return map;
  try {
    const querier = getNadoQuerier();
    const products = await querier.getPerpProducts(productIds);
    for (const p of products ?? []) {
      const productId = Number(p.productId);
      const oiBase = Number(p.state?.openInterest ?? BigInt('0')) / X18;
      const priceUsd = Number(p.oraclePriceX18 ?? BigInt('0')) / X18;
      if (oiBase > 0) map.set(productId, oiBase * priceUsd);
    }
  } catch (err) {
    console.warn('Nado getPerpProducts failed — open interest unavailable:', errorMessage(err));
  }
  return map;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

export { errorMessage as getNadoErrorMessage };
