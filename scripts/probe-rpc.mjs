// Determines where getUserReserveData actually lives: Pool vs PoolDataProvider.
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const apiKey = env.match(/^NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)$/m)?.[1]?.trim();
const POOL = '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA';
const PDP = '0x96086C25d13943C80Ff9a19791a40Df6aFC08328';
const USER = '0x0000000000000000000000000000000000000001';
const WETH = '0x4200000000000000000000000000000000000006';

const iface = new ethers.Interface([
  'function getUserReserveData(address asset, address user) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)',
  'function getUserAccountData(address user) view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
]);

async function rawCall(provider, to, data) {
  try {
    const result = await provider.call({ to, data });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.shortMessage ?? err.message, data: err.data ?? null };
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(`https://ink-mainnet.g.alchemy.com/v2/${apiKey}`, 57073, { staticNetwork: true });

  const selector = iface.getFunction('getUserReserveData(address,address)').selector;
  console.log('getUserReserveData selector:', selector);

  for (const [name, to] of [['POOL', POOL], ['PDP', PDP]]) {
    const r = await rawCall(provider, to, iface.encodeFunctionData('getUserReserveData', [WETH, USER]));
    if (r.ok) {
      const decoded = iface.decodeFunctionResult('getUserReserveData', r.result);
      console.log(`${name}: OK -> aTokenBal=${ethers.formatUnits(decoded[0], 18)}`);
    } else {
      console.log(`${name}: FAILED -> ${r.error}${r.data ? ` data=${r.data}` : ''}`);
    }
  }

  const acctSelector = iface.getFunction('getUserAccountData(address)').selector;
  console.log('\ngetUserAccountData selector:', acctSelector);
  const r = await rawCall(provider, POOL, iface.encodeFunctionData('getUserAccountData', [USER]));
  console.log(r.ok ? 'POOL getUserAccountData: OK' : `POOL getUserAccountData: FAILED -> ${r.error}`);
}

main().catch((err) => console.error('fatal:', err.shortMessage ?? err.message));
