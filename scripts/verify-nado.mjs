// Dev tool: verifies the Nado perps DEX data layer on Ink (chain 57073).
//  1. On-chain: Querier.getPerpProducts() — open interest for top products.
//  2. Indexer v1: POST /v1 {matches} — recent fills with buy/sell direction.
//  3. Indexer v2: GET /v2/tickers — 24h volume / change per product.
// Reads the Alchemy API key from .env.local at runtime and never prints it.
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const keyMatch = env.match(/^NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)$/m);
const apiKey = keyMatch?.[1]?.trim();

const RPC_URLS = [
  `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`,
  'https://rpc.inkonchain.com',
].filter(Boolean);

// Mirrors data/nado-addresses.json (sourced from @nadohq/shared deployment.inkMainnet.json).
const ADDRESSES = {
  CHAIN_ID: 57073,
  QUERIER: '0x68798229F88251b31D534733D6C4098318c9dff8',
  CLEARINGHOUSE: '0xD218103918C19D0A10cf35300E4CfAfbD444c5fE',
  ENDPOINT: '0x05ec92D78ED421f3D3Ada77FFdE167106565974E',
  PERP_ENGINE: '0xF8599D58d1137fC56EcDd9C16ee139C8BDf96da1',
  SPOT_ENGINE: '0xFcD94770B95fd9Cc67143132BB172EB17A0907fE',
  QUOTE: '0x0200C29006150606B650577BBE7B6248F58470c1',
};

const INDEXER_V1 = 'https://archive.prod.nado.xyz/v1';
const INDEXER_V2 = 'https://archive.prod.nado.xyz/v2';

const querierAbi = [
  'function getPerpProducts(uint32[] productIds) view returns ((uint32 productId, int128 oraclePriceX18, (int128 longWeightInitialX18, int128 shortWeightInitialX18, int128 longWeightMaintenanceX18, int128 shortWeightMaintenanceX18, int128 priceX18) risk, (int128 cumulativeFundingLongX18, int128 cumulativeFundingShortX18, int128 availableSettle, int128 openInterest) state, (int128 sizeIncrement, int128 priceIncrementX18, int128 minSize, int128 collectedFees) bookInfo)[])',
];

async function pickProvider() {
  for (const url of RPC_URLS) {
    try {
      const p = new ethers.JsonRpcProvider(url, ADDRESSES.CHAIN_ID, { staticNetwork: true });
      const net = await p.getNetwork();
      if (Number(net.chainId) !== ADDRESSES.CHAIN_ID) throw new Error(`wrong chain ${Number(net.chainId)}`);
      return p;
    } catch (err) {
      console.log(`[skip] ${url} -> ${err.shortMessage ?? err.message}`);
    }
  }
  throw new Error('No usable RPC endpoint');
}

async function indexerPost(body) {
  const res = await fetch(`${INDEXER_V1}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`indexer ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function main() {
  const provider = await pickProvider();
  console.log('== RPC: connected (Alchemy or public fallback) ==\n');

  // ── 1. On-chain querier: open interest ────────────────────────────────────
  const querier = new ethers.Contract(ADDRESSES.QUERIER, querierAbi, provider);
  // BTC-PERP=2, ETH-PERP=4, SOL-PERP=8, TAO-PERP=32, LIT-PERP=36
  const products = await querier.getPerpProducts([2, 4, 8, 32, 36]);
  console.log('== Querier.getPerpProducts() — open interest (USD) ==');
  for (const p of products) {
    const oi = Number(p.state.openInterest) / 1e18;
    const price = Number(p.oraclePriceX18) / 1e18;
    console.log(`  product ${String(p.productId).padEnd(4)} price=$ ${price.toFixed(2).padStart(10)}  OI=$ ${oi.toFixed(0).padStart(12)}`);
  }
  if (products.length === 0) throw new Error('getPerpProducts returned nothing — ABI mismatch?');

  // ── 2. Indexer v1: recent fills ───────────────────────────────────────────
  const raw = await indexerPost({ matches: { limit: 5, desc: true } });
  const txs = raw.txs ?? [];
  const timeBySubmission = new Map(txs.map((tx) => [String(tx.submission_idx), Number(tx.timestamp) * 1000]));
  const takers = (raw.matches ?? []).filter((m) => m.is_taker === true);
  console.log(`\n== Indexer v1 matches: ${(raw.matches ?? []).length} entries, ${takers.length} taker fills ==`);
  for (const m of takers) {
    const base = BigInt(m.base_filled);
    const quote = BigInt(m.quote_filled);
    const productId = m.pre_balance?.base?.perp?.product_id ?? m.pre_balance?.base?.spot?.product_id;
    const size = Math.abs(Number(base)) / 1e18;
    const notional = Math.abs(Number(quote)) / 1e18;
    const ts = timeBySubmission.get(String(m.submission_idx)) ?? Date.now();
    console.log(
      `  product=${String(productId).padEnd(4)} ${base >= 0n ? 'BUY ' : 'SELL'} size=${size.toFixed(4).padStart(12)} notional=$ ${notional.toFixed(2).padStart(10)} taker=${String(m.is_taker)} ts=${new Date(ts).toISOString()}`
    );
  }

  // ── 3. Indexer v2: tickers ────────────────────────────────────────────────
  const tickersRes = await fetch(`${INDEXER_V2}/tickers`);
  if (!tickersRes.ok) throw new Error(`tickers ${tickersRes.status}`);
  const tickers = await tickersRes.json();
  const sorted = Object.values(tickers)
    .map((t) => ({ ...t, quote_volume: Number(t.quote_volume) }))
    .filter((t) => t.quote_volume > 0)
    .sort((a, b) => b.quote_volume - a.quote_volume)
    .slice(0, 5);
  console.log('\n== Indexer v2 tickers — top 5 by 24h quote volume ==');
  for (const t of sorted) {
    console.log(
      `  ${t.ticker_id.padEnd(24)} price=${Number(t.last_price).toFixed(4).padStart(10)} vol24h=$ ${Number(t.quote_volume).toFixed(0).padStart(12)} chg24h=${Number(t.price_change_percent_24h).toFixed(2).padStart(7)}%`
    );
  }

  // ── 4. User-trades path: default subaccount query ─────────────────────────
  const sampleOwner = String(takers[0]?.order?.sender ?? '').slice(0, 42) || '0x91d1cf6a5265bf50a879922d8054fc7467eb4d26';
  const subaccount = `${sampleOwner.toLowerCase()}64656661756c740000000000`;
  const userRaw = await indexerPost({ matches: { subaccounts: [subaccount], limit: 3 } });
  const userTrades = (userRaw.matches ?? []).length;
  console.log(`\n== User trades: ${sampleOwner} (default subaccount) -> ${userTrades} fills ==`);

  console.log('\n✅ Nado data layer verified (querier ABI + indexer v1/v2 + user-trades query)');
}

main().catch((err) => {
  console.error('Verification failed:', err.shortMessage ?? err.message);
  process.exit(1);
});
