# Deploy Tydro subgraph to The Graph + wire up thegraph-mcp

Target: index the **Tydro** Aave V3 white-label pool on **Ink mainnet (chain
57073)** — Pool `0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA` — with an
**own** subgraph on **The Graph (Subgraph Studio)**, replacing the Goldsky
placeholder at `NEXT_PUBLIC_GRAPHQL_ENDPOINT`.

Status 2026-08-26: on-chain facts verified, local toolchain validated, MCP
server installed & configured. Remaining manual steps (Studio account, keys,
deploy) are yours — exact commands below.

---

## 0. Key facts (verified on-chain, 2026-08-26)

- The Ink `PoolAddressesProviderRegistry` `0x501B4c19dd9C2e06E94dA7b6D5Ed4ddA013EC741`
  contains **exactly one** provider: Tydro's PoolAddressesProvider
  `0x4172E6aAEC070ACB31aaCE343A58c93E4C70f44D` (id 1). Its `getPool()` is
  `0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA` ✓ and its oracle is the
  standard Ink AaveOracle `0x4758213271BFdC72224A7a8742dC865fC97756e1` ✓.
- ⇒ the repo's stock `config/ink-v3.json` already describes the Tydro
  deployment. The official Aave "Ink V3" subgraph
  (`6AY9ccNwMwd3G27zp9vUKWCi9ugvNS6gkh5EEBY2xnPC`) is built from this exact
  config, so it is proven-good.
- Deployment blocks (binary search on `getCode`): registry & Tydro PAP =
  `19954027`, oracle = `19954039`, Pool & RewardsController = `19954047`.
- `config/tydro-ink-v3.json` was added: identical addresses/blocks, so the
  Tydro subgraph indexes only the Tydro pool (the registry's sole provider).
- Schema: `schemas/v3.schema.graphql` (user-confirmed). Caveats (verified
  against the LIVE deployment 2026-08-26):
  - `Reserve.utilizationRate` exists, but `price.priceInUsd` does NOT —
    `PriceOracleAsset` exposes `priceInEth` (1e18) + `oracle.usdPriceEth`
    (1e8); the app derives USD as `priceInEth × usdPriceEth / 1e18`.
  - `Reserve` uses `totalCurrentVariableDebt` / `totalPrincipalStableDebt`
    (NOT `totalVariableDebt` / `totalStableDebt` — those error).
  - `lib/queries/tydro.ts` was fixed 2026-08-26 to match all of the above.
  - `Position`/`PositionAsset` entities do NOT exist in this schema → the
    app's **user position** / **community** queries fail; `use-tydro-subgraph.ts`
    then falls back to the RPC path. Aligning queries or schema is a follow-up.
  - The subgraph lags the chain head by ~31M blocks and had ZERO Reserve
    entities at block 23.3M (2026-08-26). `use-tydro-subgraph.ts` has a
    freshness gate (`SUBGRAPH_MAX_LAG_BLOCKS = 300`) — the panel only trusts
    subgraph data within 300 blocks of the RPC chain head and stays on RPC
    until Goldsky catches up.

---

## 1. thegraph-mcp (DeepSeek CLI) — DONE on this machine

Installed & configured:

- Server source: `C:\Users\Hello!\thegraph-mcp` (clone of
  `github.com/kukapay/thegraph-mcp`, Python 3.10+; MIT).
- Runtime: `python C:\Users\Hello!\thegraph-mcp\main.py` (stdio MCP).
  Requires `mcp<2` (thegraph-mcp uses the v1 `FastMCP` API — the PyPI
  `thegraph-mcp` package is an empty stub and does NOT ship the server).
- Config: `C:\Users\Hello!\.gemini\config\mcp_config.json`:

  ```json
  {
    "mcpServers": {
      "thegraph-mcp": {
        "command": "python",
        "args": ["C:\\Users\\Hello!\\thegraph-mcp\\main.py"],
        "cwd": "C:\\Users\\Hello!\\thegraph-mcp",
        "env": { "THEGRAPH_API_KEY": "$THEGRAPH_API_KEY" }
      }
    }
  }
  ```

- Tools after restart (`/mcp` or `/mcp list` to check): `getSubgraphSchema`
  and `querySubgraph` (as `mcp_thegraph-mcp_*`). Both hit
  `https://gateway.thegraph.com/api/<key>/subgraphs/id/<id>` — works for
  Studio deployment IDs (the `Qm…` hash printed by `graph deploy`).

### Still needed (1 min): the API key

1. Open https://thegraph.com/studio/apikeys/ (sign in with wallet).
2. Create an API key, copy it.
3. Set it as an env var for the CLI to pick up (the config references
   `$THEGRAPH_API_KEY`; the CLI expands it at startup):

   ```powershell
   setx THEGRAPH_API_KEY "sg_..."     # new shells only — restart the CLI
   ```

   (Or paste the key directly into the `env` block of `mcp_config.json`.)

---

## 2. Create the Studio subgraph (you, in browser)

1. https://thegraph.com/studio/ → "Create a Subgraph".
2. Slug: `tydro-ink` (used below; change consistently if you prefer another).
3. Copy the **Deploy Key** shown on the subgraph page.

> Free tier: up to 3 unpublished subgraphs per account. Deploy ≠ publish:
> the studio deployment is queryable immediately by ID/hash; "Publish" on
> the network is a separate, optional step.

---

## 3. Build & deploy (scripted, Windows-native)

Already prepared in `protocol-subgraphs/`:

- `config/tydro-ink-v3.json` — Tydro addresses + start blocks.
- `scripts/deploy-tydro-studio.ps1` — auth → mustache render →
  `schemas/v3.schema.graphql` → `graph codegen` → `graph build` →
  `graph deploy` (Studio).

```powershell
cd C:\Users\Hello!\Desktop\inkscope\protocol-subgraphs
.\scripts\deploy-tydro-studio.ps1 -DeployKey "<STUDIO_DEPLOY_KEY>" -Slug tydro-ink -VersionLabel 0.0.1
```

Manual equivalent (all via the repo-local `npx graph` / `npx mustache`):

```powershell
npx graph auth "<STUDIO_DEPLOY_KEY>"
cmd /c "npx mustache ./config/tydro-ink-v3.json ./templates/v3.subgraph.template.yaml > subgraph.yaml"
Copy-Item ./schemas/v3.schema.graphql ./schema.graphql -Force
npx graph codegen --output-dir ./generated
npx graph build
npx graph deploy tydro-ink --version-label 0.0.1 ./subgraph.yaml
```

> graph-cli 0.98.x note: the `--studio` flag no longer exists — auth takes the
> deploy key directly (`graph auth <key>`) and `graph deploy` defaults to the
> Studio node (`https://api.studio.thegraph.com/deploy/`) whenever a deploy
> key is present. `--access-token` (hosted service) is deprecated.

Output ends with the deployment ID (a `Qm…` IPFS hash) and the query URL
`https://api.studio.thegraph.com/query/<ACCOUNT_ID>/tydro-ink/<VERSION>`.
Save the `Qm…` hash — that is the `subgraphId` for the MCP tools.

> Note: the repo's `npm run deploy:hosted:ink-v3` path targets the
> deprecated hosted service (`ACCESS_TOKEN`) — do NOT use it. Studio deploy
> uses a deploy key (`graph auth <key>` + default Studio node), as above.

---

## 4. Wire the app & verify

1. Point the app at the new subgraph (`C:\Users\Hello!\Desktop\inkscope\.env.local`):

   ```ini
   NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://api.studio.thegraph.com/query/<ACCOUNT_ID>/tydro-ink/0.0.1
   ```

   (The Goldsky `inkscope/1.0.0` placeholder can then be deleted/ignored.)

2. Restart the CLI, then ask the MCP server to verify the deployment, e.g.:

   > get the schema of subgraph `<Qm…>` as text, then query its first 5 reserves

   or directly, once indexing completes (`graph deploy` output shows sync
   status; the reserves overview panel in the app shows "via subgraph").

---

## 5. Cleanup / troubleshooting

- Wrong API key → tools return "API key is required. Set THEGRAPH_API_KEY…".
- `graph build` fails on this machine → same webpack-style `!` path issue;
  robocopy `protocol-subgraphs` to `C:\inkscope-clean`, build there.
- `Position` queries fail on this schema → expected (see §0); panel falls
  back to RPC.
- Re-deploy updates: bump `-VersionLabel` (e.g. `0.0.2`); same slug.
