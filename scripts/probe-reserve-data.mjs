// Diagnose why Pool.getReserveData failed in the balanceOf fallback.
// Tests: (1) Pool.getReserveData with my tuple ABI, (2) raw eth_call data,
// (3) UiPoolDataProvider.getReserveData (protocol-level, standard Aave V3).
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

const USDC = '0x2D270e6886d130D724215A266106e6832161EAEd';

// 1) Pool.getReserveData with the tuple ABI used in lib/tydro.ts
const poolAbi = [
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)',
  'function getReservesList() view returns (address[])',
];
const pool = new ethers.Contract(a.pool, poolAbi, p);
try {
  const rd = await pool.getReserveData(USDC);
  console.log('1) Pool.getReserveData OK: aToken=' + rd.aTokenAddress);
} catch (e) {
  console.log('1) Pool.getReserveData FAILED:', e.shortMessage || e.message);
}

// 2) raw eth_call with the getReserveData(address) selector
const sel = '0x35ea6a75'; // getReserveData(address)
const data = sel + USDC.slice(2).toLowerCase().padStart(64, '0');
try {
  const raw = await p.call({ to: a.pool, data });
  console.log('2) raw eth_call OK, length:', ((raw.length - 2) / 2).toString(), 'bytes (expect 384 for full ReserveData struct)');
  console.log('   configuration word:', raw.slice(0, 66));
  if (raw.length > 66) console.log('   liquidityIndex word:', raw.slice(64, 130));
} catch (e) {
  console.log('2) raw eth_call FAILED:', e.shortMessage || e.message);
}

// 3) UiPoolDataProvider.getReserveData — standard protocol-level read
const uiPoolAbi = [
  'function getReserveData(address provider, address asset) view returns (uint256 unbackedTokens, uint256 accruedToTreasury, uint256 totalATokenSupply, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)',
];
const uiPool = new ethers.Contract(a.uiPoolDataProvider, uiPoolAbi, p);
try {
  const ud = await uiPool.getReserveData(a.poolAddressesProvider, USDC);
  console.log('3) UiPool.getReserveData OK: aToken=' + ud.aTokenAddress + ' vDebt=' + ud.variableDebtTokenAddress + ' sDebt=' + ud.stableDebtTokenAddress);
} catch (e) {
  console.log('3) UiPool.getReserveData FAILED:', e.shortMessage || e.message);
}
