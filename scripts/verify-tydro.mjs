// Dev tool: verifies Tydro (Aave V3 on Ink, chain 57073) contract addresses
// against the live chain via Alchemy RPC. Reads the API key from .env.local
// at runtime and never prints it.
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const keyMatch = env.match(/^NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)$/m);
const apiKey = keyMatch?.[1]?.trim();

const RPC_URLS = [
  `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`,
  'https://rpc.inkonchain.com',
].filter(Boolean);

const ADDRESSES = {
  POOL: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA',
  POOL_ADDRESSES_PROVIDER: '0x4172E6aAEC070ACB31aaCE343A58c93E4C70f44D',
  POOL_DATA_PROVIDER: '0x96086C25d13943C80Ff9a19791a40Df6aFC08328',
  UI_POOL_DATA_PROVIDER: '0x39bc1bfDa2130d6Bb6DBEfd366939b4c7aa7C697',
  ORACLE: '0x4758213271BFdC72224A7a8742dC865fC97756e1',
  WETH_GATEWAY: '0xDe090EfCD6ef4b86792e2D84E55a5fa8d49D25D2',
};

const poolAbi = [
  'function getReservesList() view returns (address[])',
  'function ADDRESSES_PROVIDER() view returns (address)',
  'function getReserveData(address) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 currentLiquidityRate, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt) data)',
];

const poolDataProviderAbi = [
  'function getReserveConfigurationData(address) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)',
  'function getReserveData(address) view returns (uint256 unbackedTokens, uint256 accruedToTreasury, uint256 totalATokenSupply, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint256 lastUpdateTimestamp)',
];

const addressesProviderAbi = [
  'function getPool() view returns (address)',
  'function getPoolDataProvider() view returns (address)',
  'function getPriceOracle() view returns (address)',
];

async function main() {
  let provider = null;
  let rpcLabel = '';
  for (const url of RPC_URLS) {
    try {
      const p = new ethers.JsonRpcProvider(url, 57073, { staticNetwork: true });
      const net = await p.getNetwork();
      if (Number(net.chainId) !== 57073) throw new Error(`wrong chain ${Number(net.chainId)}`);
      provider = p;
      rpcLabel = url.includes('alchemy') ? 'alchemy' : 'public-rpc';
      break;
    } catch (err) {
      console.log(`[skip] ${url} -> ${err.shortMessage ?? err.message}`);
    }
  }
  if (!provider) throw new Error('No usable RPC endpoint');

  console.log(`\n== RPC: ${rpcLabel} ==\n`);

  const pool = new ethers.Contract(ADDRESSES.POOL, poolAbi, provider);
  const providerContract = new ethers.Contract(ADDRESSES.POOL_ADDRESSES_PROVIDER, addressesProviderAbi, provider);
  const pdp = new ethers.Contract(ADDRESSES.POOL_DATA_PROVIDER, poolDataProviderAbi, provider);

  // 1. PoolAddressesProvider consistency
  const [poolFromPap, pdpFromPap, oracleFromPap] = await Promise.all([
    providerContract.getPool(),
    providerContract.getPoolDataProvider(),
    providerContract.getPriceOracle(),
  ]);
  console.log('getPool()            =', poolFromPap, poolFromPap.toLowerCase() === ADDRESSES.POOL.toLowerCase() ? 'OK' : 'MISMATCH');
  console.log('getPoolDataProvider()=', pdpFromPap, pdpFromPap.toLowerCase() === ADDRESSES.POOL_DATA_PROVIDER.toLowerCase() ? 'OK' : 'MISMATCH');
  console.log('getPriceOracle()     =', oracleFromPap, oracleFromPap.toLowerCase() === ADDRESSES.ORACLE.toLowerCase() ? 'OK' : 'MISMATCH');

  // 2. Reserves list
  const reserves = await pool.getReservesList();
  console.log(`\nReserves (${reserves.length}):`);
  for (const r of reserves) {
    const [cfg, data] = await Promise.all([
      pdp.getReserveConfigurationData(r),
      pdp.getReserveData(r),
    ]);
    const decimals = Number(cfg.decimals);
    const totalSupply = ethers.formatUnits(data.totalATokenSupply, decimals);
    const totalDebt = ethers.formatUnits(data.totalVariableDebt + data.totalStableDebt, decimals);
    const liqRate = Number(data.liquidityRate) / 1e27;
    const varRate = Number(data.variableBorrowRate) / 1e27;
    const util = Number(data.totalATokenSupply) > 0n
      ? ((Number(data.totalVariableDebt) + Number(data.totalStableDebt)) / Number(data.totalATokenSupply)) * 100
      : 0;
    console.log(
      `${r} | dec=${decimals} | supply=${Number(totalSupply).toFixed(2)} | debt=${Number(totalDebt).toFixed(2)} | util=${util.toFixed(1)}% | supplyAPY=${(liqRate * 100).toFixed(2)}% | varBorrowAPY=${(varRate * 100).toFixed(2)}%`
    );
  }

  // 3. User-position path: find real users from recent Supply events, then
  //    call getUserAccountData / getUserReserveData (same ABI as lib/tydro.ts).
  const userPoolAbi = [
    'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
    'function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint256 stableRateLastUpdated, bool usageAsCollateralEnabled)',
  ];
  const userPool = new ethers.Contract(ADDRESSES.POOL, userPoolAbi, provider);

  console.log('\n== User position path ==');
  let sample = '0x0000000000000000000000000000000000000001';
  try {
    const supplyTopic = ethers.id('Supply(address,address,address,uint256,uint16)');
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(latest - 300, 0); // ~10 min of Ink blocks
    const logs = await provider.getLogs({
      address: ADDRESSES.POOL,
      fromBlock,
      toBlock: latest,
      topics: [supplyTopic],
    });
    const users = [...new Set(logs.map((l) => `0x${l.topics[2].slice(26)}`.toLowerCase()))];
    console.log(`Supply events in last ~10m: ${logs.length}, unique users: ${users.length}`);
    sample = users[0] ?? sample;
  } catch (err) {
    console.log(`getLogs failed (${err.shortMessage ?? err.message}) — using dummy address for ABI validation`);
  }
  console.log(`Sampling user: ${sample}`);

  const [acct, wethUser] = await Promise.all([
    userPool.getUserAccountData(sample),
    userPool.getUserReserveData(reserves[0], sample),
  ]);
  const collateralUsd = Number(ethers.formatUnits(acct.totalCollateralBase, 8));
  const debtUsd = Number(ethers.formatUnits(acct.totalDebtBase, 8));
  const hf = acct.healthFactor >= 2n ** 255n ? 'inf' : Number(ethers.formatUnits(acct.healthFactor, 18)).toFixed(2);
  console.log(
    `collateral=$${collateralUsd.toFixed(2)} | debt=$${debtUsd.toFixed(2)} | hf=${hf} | WETH aToken balance=${ethers.formatUnits(wethUser.currentATokenBalance, 18)}`
  );
  console.log('\n✅ user-position ABI path verified');
}

main().catch((err) => {
  console.error('Verification failed:', err.shortMessage ?? err.message);
  process.exit(1);
});
