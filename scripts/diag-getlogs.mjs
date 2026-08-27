import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const apiKey = env.match(/^NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)$/m)?.[1]?.trim();

const url = `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`;
const p = new ethers.JsonRpcProvider(url, 57073, { staticNetwork: true });

(async () => {
  for (const [label, params] of [
    ['old 19954027-19954047 no-filter', [{ fromBlock: '0x1307d9b', toBlock: '0x1307e0f' }]],
    ['mid 19954027 no-filter 100', [{ fromBlock: '0x1307d9b', toBlock: '0x1307dfb' }]],
  ]) {
    try {
      const logs = await p.send('eth_getLogs', params);
      console.log(`${label}: OK (${logs.length})`);
    } catch (err) {
      console.log(`${label}: FAIL -> ${err?.body ?? err?.shortMessage ?? err.message}`);
    }
  }
})();
