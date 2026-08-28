// Dev tool: determines the USD pricing formula for the liquidity subgraph.
// Calls the Tydro AaveOracle (Ink) getAssetPrice for the tracked tokens and
// infers the oracle base currency from the returned magnitudes:
//   - price(WETH) ~ 1e18 with 18 decimals  -> ETH-based base currency
//   - price(USDC) ~ 1e8  with 8 decimals   -> USD-based base currency
// Prints the exact conversion formula to use in the subgraph mapping.
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

const ORACLE = '0x4758213271BFdC72224A7a8742dC865fC97756e1';

const ASSETS = [
  { key: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  { key: 'USDC (native)', address: '0x2D270e6886d130D724215A266106e6832161EAEd', decimals: 6 },
  { key: 'USDC.e', address: '0xF1815bd50389c46847f0Bda824eC8da914045D14', decimals: 6 },
  { key: 'USDT0', address: '0x0200C29006150606B650577BBE7B6248F58470c1', decimals: 6 },
];

const oracleAbi = [
  'function getAssetPrice(address) view returns (uint256)',
  'function getSourceOfAsset(address) view returns (address)',
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

async function main() {
  const provider = await connect();
  const oracle = new ethers.Contract(ORACLE, oracleAbi, provider);

  const prices = {};
  for (const a of ASSETS) {
    try {
      const [price, source] = await Promise.all([
        oracle.getAssetPrice(a.address),
        oracle.getSourceOfAsset(a.address),
      ]);
      prices[a.key] = { price: price.toString(), source };
      console.log(`${a.key}: price=${price} (${Number(price)}) source=${source}`);
    } catch (err) {
      console.log(`${a.key}: oracle call failed -> ${err.shortMessage ?? err.message}`);
    }
  }

  const weth = prices['WETH'];
  const usdc = prices['USDC (native)'];
  const usdt = prices['USDT0'];

  if (weth && usdc) {
    const wethPerEth = Number(weth.price); // raw oracle magnitude
    const usdcPrice = Number(usdc.price);
    if (wethPerEth >= 1e18 * 0.9 && wethPerEth <= 1e18 * 1.1) {
      console.log('FORMULA: oracle is ETH-based (price in ETH, 18 decimals)');
      // usdPerEth from USDC: price(USDC) = USDC in ETH (e.g. 2.85e14)
      if (usdcPrice > 0) {
        const usdPerEth = 1e18 / usdcPrice;
        console.log(`  usdPerEth = 1e18 / price(USDC) = 1e18 / ${usdcPrice} = ${usdPerEth.toFixed(2)}`);
        console.log('  amountUsd(WETH) = amount / 1e18 * usdPerEth');
        console.log('  amountUsd(stables) = amount / 1e6');
      }
    } else if (usdcPrice >= 1e8 * 0.9 && usdcPrice <= 1e8 * 1.1) {
      console.log('FORMULA: oracle is USD-based (8 decimals)');
      console.log('  amountUsd(token) = amount * price(token) / 10^(decimals + 8)');
    } else {
      console.log('FORMULA: unexpected magnitudes — manual inspection required.');
    }
  }
}

main().catch((err) => {
  console.error('Probe failed:', err.message);
  process.exit(1);
});
