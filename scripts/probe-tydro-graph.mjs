// Dev tool: probes Ink mainnet (chain 57073) for everything needed to deploy
// the Tydro (Aave V3 white-label) subgraph to The Graph:
//   - whether Tydro's PoolAddressesProvider is registered in the standard
//     Ink PoolAddressesProviderRegistry (and at which block)
//   - the ProxyCreated / registration block ordering (does the registry →
//     PoolAddressesProvider template chain catch the POOL proxy creation?)
//   - deployment blocks for binary search (getCode) of key contracts
//   - best-effort RewardsController detection for Tydro's aTokens
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

const TYDRO_PAP = '0x4172E6aAEC070ACB31aaCE343A58c93E4C70f44D';
const TYDRO_POOL = '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA';
const STANDARD_REGISTRY = '0x501B4c19dd9C2e06E94dA7b6D5Ed4ddA013EC741';
const STANDARD_ORACLE = '0x4758213271BFdC72224A7a8742dC865fC97756e1';
const STANDARD_REWARDS = '0xD93e3Ae8f69D04d484d1652Ca569d4b0522414DF';

const registryAbi = [
  'function getAddressesProvidersList() view returns (address[])',
  'function getAddressesProviderIdByAddress(address) view returns (uint256)',
];
const papAbi = [
  'function getPool() view returns (address)',
  'function getPoolConfigurator() view returns (address)',
  'function getPoolDataProvider() view returns (address)',
  'function getPriceOracle() view returns (address)',
];
const poolAbi = [
  'function getReserveData(address) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 currentLiquidityRate, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt) data)',
];
const rewardsAbi = [
  'function getRewardsByAsset(address) view returns (address[])',
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

/** First block where the address has code (binary search). */
async function deploymentBlock(provider, address, hi) {
  let lo = 0;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const code = await provider.getCode(address, mid);
    if (code === '0x') lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

async function main() {
  const provider = await connect();
  const latest = await provider.getBlockNumber();
  console.log(`latest block: ${latest}\n`);

  const registry = new ethers.Contract(STANDARD_REGISTRY, registryAbi, provider);
  const pap = new ethers.Contract(TYDRO_PAP, papAbi, provider);

  // 1. Registry membership
  const list = await registry.getAddressesProvidersList();
  console.log(`standard registry ${STANDARD_REGISTRY} providers (${list.length}):`);
  for (const p of list) console.log(`  ${p}${p.toLowerCase() === TYDRO_PAP.toLowerCase() ? '  <== TYDRO PAP' : ''}`);
  const id = await registry.getAddressesProviderIdByAddress(TYDRO_PAP);
  console.log(`\nTydro PAP id in standard registry: ${id.toString()}${id === 0n ? ' (NOT REGISTERED)' : ''}`);

  // 2. Deployment blocks first (used as getLogs floors to keep ranges narrow)
  console.log('\ndeployment blocks (first block with code):');
  const depl = {};
  for (const [label, addr] of [
    ['Tydro PAP', TYDRO_PAP],
    ['Tydro Pool', TYDRO_POOL],
    ['standard registry', STANDARD_REGISTRY],
    ['standard oracle', STANDARD_ORACLE],
    ['standard rewards', STANDARD_REWARDS],
  ]) {
    const b = await deploymentBlock(provider, addr, latest);
    depl[label] = b;
    console.log(`  ${label.padEnd(18)} ${addr} -> ${b}`);
  }

  // 3. Registration block ordering
  const regTopic = ethers.id('AddressesProviderRegistered(address,uint256)');
  let regLogs = [];
  try {
    regLogs = await provider.getLogs({
      address: STANDARD_REGISTRY,
      topics: [regTopic],
      fromBlock: depl['standard registry'],
      toBlock: latest,
    });
  } catch {
    console.log('  (log query unavailable on this RPC — Alchemy Ink serves logs only for recent blocks)');
  }
  console.log(`\nAddressesProviderRegistered events on standard registry (${regLogs.length}):`);
  for (const l of regLogs) {
    const prov = `0x${l.topics[1].slice(26)}`;
    const idNum = BigInt(l.topics[2]).toString();
    console.log(`  block ${l.blockNumber} | provider ${prov} | id ${idNum}${prov.toLowerCase() === TYDRO_PAP.toLowerCase() ? '  <== TYDRO' : ''}`);
  }

  // 4. Tydro PAP self-consistency
  const [poolFromPap, cfgFromPap, pdpFromPap, oracleFromPap] = await Promise.all([
    pap.getPool(),
    pap.getPoolConfigurator(),
    pap.getPoolDataProvider(),
    pap.getPriceOracle(),
  ]);
  console.log(`\nTydro PAP @ ${TYDRO_PAP}:`);
  console.log(`  getPool()            = ${poolFromPap}${poolFromPap.toLowerCase() === TYDRO_POOL.toLowerCase() ? ' OK' : ' MISMATCH'}`);
  console.log(`  getPoolConfigurator()= ${cfgFromPap}`);
  console.log(`  getPoolDataProvider()= ${pdpFromPap}`);
  console.log(`  getPriceOracle()     = ${oracleFromPap}${oracleFromPap.toLowerCase() === STANDARD_ORACLE.toLowerCase() ? ' (== standard Ink AaveOracle)' : ''}`);

  // 5. ProxyCreated on Tydro PAP
  const proxyTopic = ethers.id('ProxyCreated(bytes32,address)');
  let proxyLogs = [];
  try {
    proxyLogs = await provider.getLogs({
      address: TYDRO_PAP,
      topics: [proxyTopic],
      fromBlock: depl['Tydro PAP'],
      toBlock: latest,
    });
  } catch {
    console.log('  (log query unavailable on this RPC — Alchemy Ink serves logs only for recent blocks)');
  }
  console.log(`\nProxyCreated events on Tydro PAP (${proxyLogs.length}):`);
  for (const l of proxyLogs) {
    const idStr = new TextDecoder().decode(ethers.toBeArray(BigInt(l.topics[1])).filter((b) => b !== 0));
    const proxy = `0x${l.topics[2].slice(26)}`;
    console.log(`  block ${l.blockNumber} | ${idStr} -> ${proxy}`);
  }

  // 6. Best-effort: does the standard RewardsController know any Tydro aToken?
  try {
    const pool = new ethers.Contract(TYDRO_POOL, poolAbi, provider);
    const weth = '0x4200000000000000000000000000000000000006';
    const rData = await pool.getReserveData(weth);
    const aToken = rData.aTokenAddress;
    const rewards = new ethers.Contract(STANDARD_REWARDS, rewardsAbi, provider);
    const rwds = await rewards.getRewardsByAsset(aToken);
    console.log(`\nstandard RewardsController rewards for Tydro WETH aToken ${aToken}: ${rwds.length > 0 ? rwds.join(', ') : 'NONE'}`);
  } catch (err) {
    console.log(`\nrewards probe failed: ${err.shortMessage ?? err.message}`);
  }
}

main().catch((err) => {
  console.error('Probe failed:', err.shortMessage ?? err.message);
  process.exit(1);
});
