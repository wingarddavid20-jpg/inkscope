# InkScope MCP Server

InkScope exposes a minimal, **dependency-free** [Model Context Protocol](https://modelcontextprotocol.io) (MCP) endpoint so AI agents can query live Ink blockchain data — Tydro lending, Nado perps, and the ecosystem — with plain JSON-RPC 2.0 over HTTP.

- **Endpoint:** `https://inkscope-one.vercel.app/api/mcp` (local dev: `http://localhost:3000/api/mcp`)
- **Transport:** HTTP POST with `Content-Type: application/json` (Streamable HTTP, non-streaming)
- **Protocol version:** `2024-11-05`
- **Auth:** none — public, **read-only** endpoint
- **Batch requests / SSE streaming:** not supported (batches are rejected with `-32600`)

## Quick start (curl)

```bash
# 1. Initialize
curl -s https://inkscope-one.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'

# 2. Acknowledge initialization (notification — no response body expected)
curl -s https://inkscope-one.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3. List tools
curl -s https://inkscope-one.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 4. Call a tool
curl -s https://inkscope-one.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_risk_level","arguments":{"healthFactor":1.15}}}'
```

## Tools

All tools are read-only and reuse the dashboard's own data layer (on-chain RPC, Nado indexer, DefiLlama) — there is no separate data pipeline.

| Tool | Description | Arguments |
|---|---|---|
| `get_risk_level` | Map a Tydro health factor to a risk band (Conservative / Balanced / Aggressive / At Risk) with color + description. | `healthFactor`: number, or the string `"Infinity"` for no-debt positions |
| `get_tydro_overview` | Live Tydro protocol overview: TVL, borrows, utilization, available liquidity, per-reserve supply/borrow/APY. | — |
| `get_tydro_position` | Live Tydro position for an address: collateral, debt, health factor. `null` when the address has no position. | `address`: `0x` + 40 hex chars |
| `get_ink_ecosystem` | Ecosystem TVL/24h data: Tydro (RPC), Nado (indexer), and third-party protocols via DefiLlama (Veda, Sentora, Velodrome, Uniswap V4, Curve, Morpho Blue). | — |
| `get_nado_stats` | Nado perps stats: top pairs by 24h volume (price, change, open interest) + total 24h volume. | `limit?`: number, default 8, max 20 |
| `get_key_metrics` | Dashboard key metrics: Tydro TVL, borrows, utilization + Nado 24h volume. | — |

Tool results are returned as `{ content: [{ type: "text", text: "<pretty-printed JSON>" }] }`.

## Registering in an agent

### Cursor (remote MCP)

1. Open **Settings → MCP → + Add new global MCP server**.
2. Choose **Type: remote** (streamable HTTP), set **URL** to `https://inkscope-one.vercel.app/api/mcp`.

### Generic `mcpServers` JSON

```json
{
  "mcpServers": {
    "inkscope": {
      "type": "http",
      "url": "https://inkscope-one.vercel.app/api/mcp"
    }
  }
}
```

## Error handling

Standard JSON-RPC 2.0 error codes:

| Code | Meaning |
|---|---|
| `-32700` | Parse error — request body is not valid JSON |
| `-32600` | Invalid request (not an object, wrong `jsonrpc`, or a batch) |
| `-32601` | Method not found |
| `-32602` | Invalid params, or unknown tool name in `tools/call` |
| `-32603` | Internal error — the tool's data source failed (details in `data`) |

Notifications (`notifications/initialized`) are acknowledged with an empty `202` response. `GET` returns `405`; `OPTIONS` returns `204` with CORS headers.

## Notes

- Server-side tools call the chain / indexers, so **`NEXT_PUBLIC_ALCHEMY_API_KEY` must be set in the deployment environment** (Vercel) or the RPC-backed tools fall back to public RPC URLs.
- CORS is wide open (`Access-Control-Allow-Origin: *`) so any agent or IDE can call the endpoint.
- The implementation lives in `lib/mcp-server.ts` (pure JSON-RPC, no Next.js imports) + `app/api/mcp/route.ts` (thin HTTP adapter).
