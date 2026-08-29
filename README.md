# InkScope — The Ink Ecosystem Dashboard

[![Live Demo](https://img.shields.io/badge/demo-live-green)](https://inkscope-one.vercel.app/)
[![Built on Ink](https://img.shields.io/badge/Built%20on-Ink-7337F2)](https://inkonchain.com)

**InkScope** is a real-time on-chain analytics dashboard for the Ink blockchain. It aggregates live data from **Tydro** (lending) and **Nado** (perpetuals), providing users with portfolio tracking, protocol analytics, risk labels, and ecosystem overviews — all in one place.

## 🚀 Live Demo
👉 [https://inkscope-one.vercel.app/](https://inkscope-one.vercel.app/)

## ✨ Features
- **Live Tydro Data** — TVL, reserves, utilization, APYs via Alchemy RPC
- **Live Nado Data** — Recent trades, top pairs, open interest via indexer
- **Wallet Integration** — Connect wallet or paste any address to view positions
- **Risk Labels** — Automated health factor categorization (Conservative / Balanced / Aggressive / At Risk)
- **Ecosystem Overview** — Protocol list with TVL and volume tracking
- **Liquidity Flow** — Bridge and CEX capital movements
- **Trending NFTs** — Top NFT collections on Ink
- **DEX Hub** — DEXs on Ink with TVL, volume, and top pairs
- **MCP Endpoint** — AI agent-friendly API at `/api/mcp`

## 🛠️ Tech Stack
- **Framework** — Next.js 14 (App Router)
- **UI** — React + Tailwind CSS + shadcn/ui
- **Data** — ethers.js v6, Alchemy RPC, Nado Indexer, Goldsky Subgraph
- **Styling** — bolt.fun-inspired design (dark theme, glassmorphism)
- **Deployment** — Vercel

## 📊 Data Sources
| Protocol | Data | Source |
|----------|------|--------|
| **Tydro** | TVL, reserves, utilization, APYs | Alchemy RPC |
| **Nado** | Trades, pairs, open interest | Nado Indexer API |
| **Bridge + CEX** | Liquidity flows | Goldsky Subgraph |
| **Ecosystem** | Protocol TVL, volume | DefiLlama API |

## 🔧 Getting Started
```bash
git clone https://github.com/wingarddavid20-jpg/inkscope.git
cd inkscope
npm install
cp .env.example .env.local
# Add your API keys to .env.local
npm run dev
```
