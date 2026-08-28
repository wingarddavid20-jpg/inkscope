// Dev tool: probes Ink mainnet (chain 57073) for ground truth needed by the
// liquidity subgraph (BridgeTransfer / CexTransfer):
//   - current chain head block
//   - eth_getCode for the tracked tokens + Across SpokePool (non-empty?)
//   - token symbol / decimals (ERC20 calls)
//   - recommended subgraph startBlock = head - 500k (1.5-2 weeks of history)
// Reads the Alchemy key from .env.local at runtime, never prints it.
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const keyMatch = env.match(/^NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)$/m);
const apiKey = keyMatch?.[1]?.trim();

const RPC_URLS = [
  `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`,
  'https://rpc.inkonchain.com',
].filter(Boolean);

const HEAD_MARGIN = 500_000; // startBlock = head - this

const TOKENS = [
  { key: 'USDC (native)', address: '0x2D270e6886d130D724215A266106e6832161EAEd' },
  { key: 'USDC.e (bridged)', address: '0xF1815bd50389c46847f0Bda824eC8da914045D14' },
  { key: 'USDT0', address: '0x0200C29006150606B650577BBE7B6248F58470c1' },
  { key: 'WETH', address: '0x4200000000000000000000000000000000000006' },
];

const BRIDGES = [
  { key: 'Across SpokePool', address: '0xeF684C38F94F48775959ECf2012D7E864ffb9dd4' },
];

const OTHER = [
  { key: 'AaveOracle (Tydro)', address: '0x4758213271BFdC72224A7a8742dC865fC97756e1' },
];

const erc20Abi = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

async function connect() {
  for (const url of RPC_URLS) {
    try {
      const p = new ethers.JsonRpcProvider(url, 57073, { staticNetwork: true });
      const net = await p.getNetwork();
      if (Number(net.chainId) !== 57073) throw new Error(`wrong chain ${Number(net.chainId)}`);
      console.log(`RPC: ${url.includes('alchemy') ? 'alchemy' : 'public-rpc'}`);
      return p;
    } catch (err) {
      console.log(`[skip] ${url} -> ${err.shortMessage ?? err.message}`);
    }
  }
  throw new Error('No usable RPC endpoint');
}

async function hasCode(provider, address) {
  try {
    const code = await provider.getCode(address);
    return code && code !== '0x' && code !== '0x0';
  } catch {
    return false;
  }
}

async function main() {
  const provider = await connect();

  const block = await provider.getBlock('latest');
  const head = block.number;
  const startBlock = head - HEAD_MARGIN;
  console.log(`head=${head} startBlock(head-${HEAD_MARGIN})=${startBlock}`);

  for (const t of TOKENS) {
    const ok = await hasCode(provider, t.address);
    let meta = '';
    if (ok) {
      try {
        const c = new ethers.Contract(t.address, erc20Abi, provider);
        const [symbol, decimals] = await Promise.all([c.symbol(), c.decimals()]);
        meta = ` symbol=${symbol} decimals=${decimals}`;
      } catch {
        meta = ' (erc20 meta failed)';
      }
    }
    console.log(`TOKEN ${t.key}: ${ok ? 'HAS_CODE' : 'NO_CODE'}: ${t.address}${meta}`);
  }

  for (const b of BRIDGES) {
    const ok = await hasCode(provider, b.address);
    console.log(`BRIDGE ${b.key}: ${ok ? 'HAS_CODE' : 'NO_CODE'}: ${b.address}`);
  }

  for (const o of OTHER) {
    const ok = await hasCode(provider, o.address);
    console.log(`OTHER ${o.key}: ${ok ? 'HAS_CODE' : 'NO_CODE'}: ${o.address}`);
  }
}

main().catch((err) => {
  console.error('Probe failed:', err.message);
  process.exit(1);
});
