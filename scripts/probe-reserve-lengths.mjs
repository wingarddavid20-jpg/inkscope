// Per-reserve: raw getReserveData length + 15-tuple decode result.
import { ethers } from 'ethers';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const apiKey = env.match(/NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)/m)[1].trim();
const a = JSON.parse(fs.readFileSync('data/tydro-addresses.json', 'utf8'));
const p = new ethers.JsonRpcProvider(
  `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`,
  a.chainId,
  { staticNetwork: true }
);

const poolAbi = [
  'function getReservesList() view returns (address[])',
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint8 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 extra1, uint256 extra2, uint256 extra3)',
];
const pool = new ethers.Contract(a.pool, poolAbi, p);

const reserves = await pool.getReservesList();
console.log('reserves:', reserves.length);

for (const r of reserves) {
  const data = '0x35ea6a75' + r.slice(2).toLowerCase().padStart(64, '0');
  let len = '?';
  try {
    const raw = await p.call({ to: a.pool, data });
    len = ((raw.length - 2) / 2).toString();
  } catch (e) {
    len = 'REVERT';
  }
  let decoded = '';
  try {
    const rd = await pool.getReserveData(r);
    decoded = 'aToken=' + rd.aTokenAddress;
  } catch (e) {
    decoded = 'DECODE FAIL: ' + (e.shortMessage || e.message).slice(0, 40);
  }
  console.log(r + '  len=' + len + '  ' + decoded);
}
