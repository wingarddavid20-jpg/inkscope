export type Metric = {
  label: string;
  value: number;
  change: number;
  spark: number[];
};

export const keyMetrics: Metric[] = [
  {
    label: 'TVL',
    value: 140_200_000,
    change: 4.82,
    spark: [120, 124, 119, 128, 132, 130, 138, 140],
  },
  {
    label: '24h Volume',
    value: 28_400_000,
    change: -2.31,
    spark: [32, 30, 31, 29, 28, 27, 29, 28],
  },
  {
    label: 'Active Wallets',
    value: 18_640,
    change: 7.14,
    spark: [14, 15, 15, 16, 16, 17, 18, 18.6],
  },
  {
    label: 'Total Borrows',
    value: 62_800_000,
    change: 1.97,
    spark: [58, 59, 60, 60, 61, 61, 62, 62.8],
  },
];

export type TrendPoint = {
  day: string;
  tvl: number;
  volume: number;
  borrows: number;
};

export const trendData: TrendPoint[] = [
  { day: 'Aug 17', tvl: 128.4, volume: 24.1, borrows: 58.2 },
  { day: 'Aug 18', tvl: 131.2, volume: 26.8, borrows: 59.0 },
  { day: 'Aug 19', tvl: 129.8, volume: 22.4, borrows: 59.6 },
  { day: 'Aug 20', tvl: 133.5, volume: 27.9, borrows: 60.3 },
  { day: 'Aug 21', tvl: 136.1, volume: 25.2, borrows: 61.1 },
  { day: 'Aug 22', tvl: 138.7, volume: 29.8, borrows: 61.9 },
  { day: 'Aug 23', tvl: 140.2, volume: 28.4, borrows: 62.8 },
];

export type RiskPosition = {
  account: string;
  health: number;
  debt: number;
  collateral: number;
  protocol: 'Tydro';
};

export const highRiskPositions: RiskPosition[] = [
  {
    account: '0x4f2c…91ab',
    health: 1.04,
    debt: 2_400_000,
    collateral: 2_496_000,
    protocol: 'Tydro',
  },
  {
    account: '0x8a1d…3e7c',
    health: 1.08,
    debt: 1_850_000,
    collateral: 1_998_000,
    protocol: 'Tydro',
  },
  {
    account: '0xb3e0…44f2',
    health: 1.12,
    debt: 3_700_000,
    collateral: 4_144_000,
    protocol: 'Tydro',
  },
  {
    account: '0xc9f1…0a8b',
    health: 1.15,
    debt: 980_000,
    collateral: 1_127_000,
    protocol: 'Tydro',
  },
  {
    account: '0x2d7a…77e1',
    health: 1.18,
    debt: 5_100_000,
    collateral: 6_018_000,
    protocol: 'Tydro',
  },
];

export type StablecoinUtil = {
  asset: string;
  symbol: string;
  supplied: number;
  borrowed: number;
  utilization: number;
  apy: number;
};

export const stablecoinUtilization: StablecoinUtil[] = [
  {
    asset: 'USDC',
    symbol: 'USDC',
    supplied: 48_200_000,
    borrowed: 31_900_000,
    utilization: 66.2,
    apy: 4.82,
  },
  {
    asset: 'USDT',
    symbol: 'USDT',
    supplied: 36_100_000,
    borrowed: 22_700_000,
    utilization: 62.9,
    apy: 4.51,
  },
  {
    asset: 'DAI',
    symbol: 'DAI',
    supplied: 18_400_000,
    borrowed: 10_200_000,
    utilization: 55.4,
    apy: 3.97,
  },
  {
    asset: 'FRAX',
    symbol: 'FRAX',
    supplied: 6_800_000,
    borrowed: 2_100_000,
    utilization: 30.9,
    apy: 2.14,
  },
];

export type LiquidityFlow = {
  protocol: string;
  inflow: number;
  outflow: number;
  net: number;
};

export const liquidityFlows: LiquidityFlow[] = [
  { protocol: 'Tydro', inflow: 12.4, outflow: 8.1, net: 4.3 },
  { protocol: 'Nado', inflow: 9.8, outflow: 6.2, net: 3.6 },
  { protocol: 'Vault-X', inflow: 5.1, outflow: 4.8, net: 0.3 },
  { protocol: 'YieldLab', inflow: 3.2, outflow: 2.9, net: 0.3 },
];

export type Supplier = {
  rank: number;
  account: string;
  supplied: number;
  share: number;
  badge?: string;
};

export const topSuppliers: Supplier[] = [
  { rank: 1, account: '0xae12…wh4l', supplied: 18_400_000, share: 13.1, badge: 'Whale' },
  { rank: 2, account: '0x7b3c…kr9s', supplied: 12_100_000, share: 8.6, badge: 'OG' },
  { rank: 3, account: '0xd4e8…mz2p', supplied: 8_900_000, share: 6.3 },
  { rank: 4, account: '0x1f6a…lo5x', supplied: 6_400_000, share: 4.6, badge: 'Maker' },
  { rank: 5, account: '0x9c0b…qu7t', supplied: 5_200_000, share: 3.7 },
];

export type Borrower = {
  rank: number;
  account: string;
  borrowed: number;
  share: number;
  badge?: string;
};

export const topBorrowers: Borrower[] = [
  { rank: 1, account: '0x3e7f…bx1n', borrowed: 9_800_000, share: 15.6, badge: 'Whale' },
  { rank: 2, account: '0x6a2d…pw8k', borrowed: 7_200_000, share: 11.5 },
  { rank: 3, account: '0xf0c1…dt3v', borrowed: 5_600_000, share: 8.9, badge: 'Leviathan' },
  { rank: 4, account: '0x8b4e…nj6q', borrowed: 4_100_000, share: 6.5 },
  { rank: 5, account: '0x2d9a…rc4w', borrowed: 3_300_000, share: 5.3, badge: 'Maker' },
];

export type Trade = {
  pair: string;
  type: 'Buy' | 'Sell';
  amount: number;
  price: number;
  time: number;
  account: string;
};

export const recentTrades: Trade[] = [
  { pair: 'INK/USDC', type: 'Buy', amount: 124_500, price: 1.84, time: Date.now() - 12_000, account: '0x4f2c…91ab' },
  { pair: 'INK/USDT', type: 'Sell', amount: 88_200, price: 1.82, time: Date.now() - 47_000, account: '0x8a1d…3e7c' },
  { pair: 'INK/ETH', type: 'Buy', amount: 210_000, price: 0.00098, time: Date.now() - 93_000, account: '0xb3e0…44f2' },
  { pair: 'INK/USDC', type: 'Buy', amount: 45_600, price: 1.85, time: Date.now() - 134_000, account: '0xc9f1…0a8b' },
  { pair: 'INK/USDT', type: 'Sell', amount: 67_300, price: 1.81, time: Date.now() - 198_000, account: '0x2d7a…77e1' },
  { pair: 'INK/ETH', type: 'Buy', amount: 156_800, price: 0.00099, time: Date.now() - 242_000, account: '0x4f2c…91ab' },
];

export type TradingPair = {
  pair: string;
  volume: number;
  change: number;
  liquidity: number;
};

export const topPairs: TradingPair[] = [
  { pair: 'INK/USDC', volume: 12_400_000, change: 3.2, liquidity: 28_400_000 },
  { pair: 'INK/USDT', volume: 8_900_000, change: -1.1, liquidity: 19_200_000 },
  { pair: 'INK/ETH', volume: 4_600_000, change: 5.8, liquidity: 11_800_000 },
  { pair: 'INK/DAI', volume: 2_500_000, change: 0.4, liquidity: 6_100_000 },
];

export type Builder = {
  name: string;
  handle: string;
  role: string;
  skills: string[];
  shipped: number;
  contribution: string;
  badge: string;
};

export const builders: Builder[] = [
  {
    name: 'Mira Okafor',
    handle: '0xmira',
    role: 'Protocol Engineer',
    skills: ['Solidity', 'ZK', 'Risk'],
    shipped: 14,
    contribution: 'Shipped Tydro v2 health engine',
    badge: 'Builder',
  },
  {
    name: 'Kai Tanaka',
    handle: 'kaibuilds',
    role: 'Frontend Maker',
    skills: ['React', 'D3', 'Design'],
    shipped: 9,
    contribution: 'Nado trading dashboard + pair explorer',
    badge: 'Maker',
  },
  {
    name: 'Sofia Reyes',
    handle: 'sofiar',
    role: 'Data Scientist',
    skills: ['Python', 'SQL', 'ML'],
    shipped: 6,
    contribution: 'Liquidity flow anomaly detector',
    badge: 'Researcher',
  },
];
