// Verify the new fetchTydroUserPosition logic (aToken/debt-token balanceOf
// fallback, no early-null on zero accountData) against the live chain for the
// user's wallet 0xb22d...0151. Mirrors lib/tydro.ts exactly.
import { ethers } from 'ethers';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const apiKey = env.match(/NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)/m)[1].trim();
const WALLET = '0xb22d22f9d74b78f425edcdd670ad7ce7f9aa0151';
const addr = JSON.parse(fs.readFileSync('data/tydro-addresses.json', 'utf8'));

const provider = new ethers.JsonRpcProvider(
  `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`,
  addr.chainId,
  { staticNetwork: true }
);

const poolAbi = [
  'function getReservesList() view returns (address[])',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint256 stableRateLastUpdated, bool usageAsCollateralEnabled)',
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint8 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 extra1, uint256 extra2, uint256 extra3)',
];
const pdpAbi = [
  'function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)',
];
const oracleAbi = ['function getAssetPrice(address asset) view returns (uint256)'];
const erc20Abi = [
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
];

const pool = new ethers.Contract(addr.pool, poolAbi, provider);
const pdp = new ethers.Contract(addr.poolDataProvider, pdpAbi, provider);
const oracle = new ethers.Contract(addr.oracle, oracleAbi, provider);

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchReserveBalances(reserveAddress) {
  try {
    const ur = await pool.getUserReserveData(reserveAddress, WALLET);
    return {
      source: 'getUserReserveData',
      suppliedRaw: ur.currentATokenBalance,
      borrowedRaw: ur.currentVariableDebt + ur.currentStableDebt,
    };
  } catch (err) {
    const msg = err?.shortMessage || err?.message || String(err);
    console.log(`  getUserReserveData REVERTED for ${reserveAddress} (${String(msg).slice(0, 60)}) -> fallback`);
  }
  try {
    const rd = await pool.getReserveData(reserveAddress);
    const erc20 = (t) => new ethers.Contract(t, erc20Abi, provider);
    const balanceOf = async (t) => {
      if (!t || /^0x0+$/i.test(t)) return 0n;
      try {
        return await erc20(t).balanceOf(WALLET);
      } catch (e) {
        console.log(`    balanceOf failed for ${t}, treating as 0 (${(e?.shortMessage || e?.message || String(e)).slice(0, 40)})`);
        return 0n;
      }
    };
    const [a, v, s] = await Promise.all([
      balanceOf(rd.aTokenAddress),
      balanceOf(rd.variableDebtTokenAddress),
      balanceOf(rd.stableDebtTokenAddress),
    ]);
    return { source: 'balanceOf', suppliedRaw: a, borrowedRaw: v + s };
  } catch (err) {
    const msg = err?.shortMessage || err?.message || String(err);
    console.log(`  balanceOf fallback FAILED for ${reserveAddress}: ${String(msg).slice(0, 80)}`);
    return null;
  }
}

async function main() {
  const [accountData, reserves] = await Promise.all([
    pool.getUserAccountData(WALLET),
    pool.getReservesList(),
  ]);
  console.log('accountData (pool-reported):', {
    collateralUsd: Number(ethers.formatUnits(accountData.totalCollateralBase, 8)).toFixed(6),
    debtUsd: Number(ethers.formatUnits(accountData.totalDebtBase, 8)).toFixed(6),
    healthFactor: accountData.healthFactor.toString(),
  });

  const raw = await mapWithConcurrency(reserves, 6, fetchReserveBalances);

  let collateralUsd = 0;
  let debtUsd = 0;
  for (let i = 0; i < reserves.length; i++) {
    const b = raw[i];
    if (!b) continue;
    const [config, priceRaw] = await Promise.all([
      pdp.getReserveConfigurationData(reserves[i]),
      oracle.getAssetPrice(reserves[i]),
    ]);
    const decimals = Number(config.decimals);
    const supplied = Number(ethers.formatUnits(b.suppliedRaw, decimals));
    const borrowed = Number(ethers.formatUnits(b.borrowedRaw, decimals));
    const price = Number(ethers.formatUnits(priceRaw, 8));
    if (supplied > 0 || borrowed > 0) {
      const sym = await new ethers.Contract(reserves[i], erc20Abi, provider).symbol();
      console.log(
        `  ${sym}: supplied=${supplied.toFixed(6)} ($${(supplied * price).toFixed(2)}) ` +
          `borrowed=${borrowed.toFixed(6)} ($${(borrowed * price).toFixed(2)}) [${b.source}]`
      );
      collateralUsd += supplied * price;
      debtUsd += borrowed * price;
    }
  }
  console.log(
    `\nREBUILT position: collateral=$${collateralUsd.toFixed(2)} debt=$${debtUsd.toFixed(2)} ` +
      `(pool-reported zeros -> balance-based rebuild; expect ~$2.69 USDC)`
  );
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
