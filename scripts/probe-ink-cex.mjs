// Dev tool: discovers candidate CEX (Kraken/Bitfinex) operational wallets on Ink
// for the liquidity subgraph's CEX_WALLETS constant.
//
// Method: pulls recent ERC-20 Transfer history for the stable tokens from the
// Ink Blockscout API (explorer.inkonchain.com, no key), aggregates per
// counterparty address (inflow = received, outflow = sent) and ranks by total
// volume. CEX hot wallets are typically EOAs (is_contract=false) with large
// churn in BOTH directions. Contract addresses (AMMs/routers/bridges) are
// flagged as contracts and are expected at the top of the volume ranking — the
// user reviews the shortlist and confirms which addresses are actual exchange
// wallets.
//
// Usage: node scripts/probe-ink-cex.mjs [entriesPerToken]   (default 3000)
import { ethers } from 'ethers'; // only used for address checksumming

const API_BASE = 'https://explorer.inkonchain.com/api/v2';
const ENTRIES_PER_TOKEN = Number(process.argv[2] ?? 5000);
const PAGE_DELAY_MS = 150; // be polite to the public explorer
const FETCH_TIMEOUT_MS = 15000;
const MAX_429_RETRIES = 3;

const TOKENS = [
  { key: 'USDC', address: '0x2D270e6886d130D724215A266106e6832161EAEd', decimals: 6 },
  { key: 'USDC.e', address: '0xF1815bd50389c46847f0Bda824eC8da914045D14', decimals: 6 },
  { key: 'USDT0', address: '0x0200C29006150606B650577BBE7B6248F58470c1', decimals: 6 },
];

// Addresses that must never be treated as CEX candidates.
const EXCLUDE = new Set(
  [
    '0x0000000000000000000000000000000000000000',
    '0x2D270e6886d130D724215A266106e6832161EAEd', // USDC
    '0xF1815bd50389c46847f0Bda824eC8da914045D14', // USDC.e
    '0x0200C29006150606B650577BBE7B6248F58470c1', // USDT0
    '0x4200000000000000000000000000000000000006', // WETH
    '0xeF684C38F94F48775959ECf2012D7E864ffb9dd4', // Across SpokePool
    '0x4758213271BFdC72224A7a8742dC865fC97756e1', // AaveOracle
  ].map((a) => a.toLowerCase())
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTokenTransfers(tokenAddress, maxEntries) {
  const out = [];
  let url = `${API_BASE}/tokens/${tokenAddress}/transfers`;
  let lastPageKey = null;
  let pages = 0;
  while (out.length < maxEntries) {
    let res;
    let retries = 0;
    for (;;) {
      res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (res.ok) break;
      if (res.status === 429 && retries < MAX_429_RETRIES) {
        retries += 1;
        await sleep(2000 * retries);
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const j = await res.json();
    for (const it of j.items ?? []) out.push(it);
    pages += 1;
    if (pages % 10 === 0) console.log(`  ${tokenAddress.slice(0, 8)}… ${out.length}/${maxEntries} entries`);
    if (!j.next_page_params) break;
    const p = j.next_page_params;
    const key = `${p.block_number}:${p.index}`;
    if (key === lastPageKey) break; // explorer gave us the same page again
    lastPageKey = key;
    url = `${API_BASE}/tokens/${tokenAddress}/transfers?block_number=${p.block_number}&index=${p.index}`;
    await sleep(PAGE_DELAY_MS);
  }
  return out.slice(0, maxEntries);
}

async function main() {
  // addr -> { per: { [tokenKey]: {in, out, inN, outN} }, isContract: boolean|null }
  const stats = new Map();

  const bump = (addr, tokenKey, isIn, amount, isContract) => {
    const a = addr.toLowerCase();
    if (EXCLUDE.has(a)) return;
    let s = stats.get(a);
    if (!s) {
      s = { per: {}, isContract: null };
      stats.set(a, s);
    }
    let p = s.per[tokenKey];
    if (!p) {
      p = { in: 0n, out: 0n, inN: 0, outN: 0 };
      s.per[tokenKey] = p;
    }
    if (isIn) {
      p.in += amount;
      p.inN += 1;
    } else {
      p.out += amount;
      p.outN += 1;
    }
    if (s.isContract === null) s.isContract = isContract;
  };

  for (const t of TOKENS) {
    const transfers = await fetchTokenTransfers(t.address, ENTRIES_PER_TOKEN);
    for (const x of transfers) {
      const fromHash = x.from?.hash;
      const toHash = x.to?.hash;
      const raw = x.total?.value;
      if (!fromHash || !toHash || !raw) continue;
      const value = BigInt(raw);
      bump(fromHash, t.key, false, value, x.from?.is_contract ?? false);
      bump(toHash, t.key, true, value, x.to?.is_contract ?? false);
    }
    const newest = transfers[0]?.timestamp;
    const oldest = transfers[transfers.length - 1]?.timestamp;
    console.log(`${t.key}: ${transfers.length} transfers (${oldest} .. ${newest})`);
  }

  const toRows = ([addr, s]) => {
    const sum = (k) =>
      Object.values(s.per).reduce((acc, p) => acc + p[k], 0n);
    const count = (k) =>
      Object.values(s.per).reduce((acc, p) => acc + p[k], 0);
    const fmt = (key) => {
      const p = s.per[key];
      return p ? `${Number(p.in) / 1e6}:${Number(p.out) / 1e6}` : '0:0';
    };
    return {
      addr: ethers.getAddress(addr),
      inUsd: Number(sum('in')) / 1e6,
      outUsd: Number(sum('out')) / 1e6,
      totalUsd: Number(sum('in') + sum('out')) / 1e6,
      inN: count('inN'),
      outN: count('outN'),
      isContract: s.isContract,
      u: fmt('USDC'),
      e: fmt('USDC.e'),
      t: fmt('USDT0'),
    };
  };

  const rows = [...stats.entries()]
    .map(toRows)
    .filter((r) => r.inUsd >= 50000 || r.outUsd >= 50000) // noise floor
    .sort((a, b) => b.totalUsd - a.totalUsd);

  const eoas = rows.filter((r) => !r.isContract);
  const contracts = rows.filter((r) => r.isContract);

  console.log('\nEOA CANDIDATES (likely CEX hot wallets — review & confirm):');
  console.log('  columns: U=USDC, E=USDC.e, T=USDT0 as in:out USD');
  for (const r of eoas.slice(0, 20)) {
    console.log(
      `  in=${r.inUsd.toFixed(0).padStart(11)} out=${r.outUsd.toFixed(0).padStart(11)} txs=${r.inN}/${r.outN} U=${r.u} E=${r.e} T=${r.t}  ${r.addr}`
    );
  }

  console.log('\nTOP CONTRACTS (reference only — not CEX candidates):');
  for (const r of contracts.slice(0, 10)) {
    console.log(
      `  in=${r.inUsd.toFixed(0).padStart(11)} out=${r.outUsd.toFixed(0).padStart(11)} txs=${r.inN}/${r.outN} U=${r.u} E=${r.e} T=${r.t}  ${r.addr}`
    );
  }

  console.log('\nREVIEW: EOAs with large two-way churn are likely CEX hot wallets.');
  console.log('Confirm the addresses before adding them to CEX_WALLETS in the subgraph.');
}

main().catch((err) => {
  console.error('Probe failed:', err.message);
  process.exit(1);
});
