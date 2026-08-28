// Diagnostic round 7: Nado subaccount state with the REAL SDK ABI
// (getSubaccountInfo from @nadohq/shared 0.38.0) + reconcile the aUSDC.
import { ethers } from 'ethers';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const apiKey = env.match(/NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)/m)[1].trim();
const WALLET = '0xb22d22f9d74b78f425edcdd670ad7ce7f9aa0151';
const QUERIER = JSON.parse(fs.readFileSync('data/nado-addresses.json', 'utf8')).querier;

const provider = new ethers.JsonRpcProvider(
  `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`,
  57073,
  { staticNetwork: true }
);

// Real ABI straight from the SDK
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sdk = require('../package/dist/abis/Querier.cjs');
const querierAbi = Array.isArray(sdk) ? sdk : (sdk.Querier || sdk.default || Object.values(sdk)[0]);

function x18(n) {
  if (n === undefined || n === null) return 0;
  return Number(ethers.formatUnits(n, 18));
}

async function main() {
  const q = new ethers.Contract(QUERIER, querierAbi, provider);
  const sub = `0x${WALLET.slice(2).toLowerCase()}64656661756c740000000000`;
  console.log(`subaccount: ${sub}`);

  const info = await q.getSubaccountInfo(sub);
  console.log('exists:', info.exists);
  console.log('spotCount:', info.spotCount, 'perpCount:', info.perpCount);

  if (info.healths?.length) {
    console.log('\n-- healths (X18) --');
    for (const h of info.healths) {
      console.log(`  assets=$${x18(h.assets).toFixed(2)} liabilities=$${x18(h.liabilities).toFixed(2)} health=$${x18(h.health).toFixed(2)}`);
    }
  }

  if (info.spotBalances?.length) {
    console.log('\n-- spot balances --');
    for (const s of info.spotBalances) {
      const v = x18(s.balance?.amount);
      if (v !== 0) console.log(`  product ${s.productId}: ${v.toFixed(6)} (USD value incl. in spotProducts below)`);
    }
  }

  if (info.perpBalances?.length) {
    console.log('\n-- perp balances --');
    for (const p of info.perpBalances) {
      const amt = x18(p.balance?.amount);
      const vq = x18(p.balance?.vQuoteBalance);
      if (amt !== 0 || vq !== 0) {
        console.log(`  product ${p.productId}: size=${amt.toFixed(6)} vQuote=${vq.toFixed(6)}`);
      }
    }
  }

  // price each spot/perp product the account touches
  console.log('\n-- product prices --');
  const productPrice = (list) => {
    for (const prod of list ?? []) {
      const price = x18(prod.oraclePriceX18);
      if (price > 0) console.log(`  product ${prod.productId}: oracle=$${price.toFixed(4)}`);
    }
  };
  productPrice(info.spotProducts);
  productPrice(info.perpProducts);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
