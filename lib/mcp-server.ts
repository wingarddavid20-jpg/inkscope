// ─────────────────────────────────────────────────────────────────────────────
// Minimal MCP (Model Context Protocol) server — JSON-RPC 2.0, zero deps.
//
// Implements the read-only MCP surface an AI agent needs to query InkScope:
//   initialize · notifications/initialized · ping · tools/list · tools/call
//
// Every tool reuses the app's existing lib/ services (tydro, nado, ecosystem)
// — no duplicated data logic, no mutations. Pure module with no Next.js
// imports; the HTTP adapter lives in app/api/mcp/route.ts.
// ─────────────────────────────────────────────────────────────────────────────

import {
  fetchTydroOverview,
  fetchTydroUserPosition,
  getRiskLevel,
} from '@/lib/tydro';
import { fetchEcosystemOverview } from '@/lib/ecosystem';
import { fetchNadoTopPairs, getNadoTickers } from '@/lib/nado';

export const MCP_PROTOCOL_VERSION = '2024-11-05';
export const MCP_SERVER_INFO = { name: 'inkscope', version: '1.0.0' } as const;
export const TOOL_TIMEOUT_MS = 8_000;

// ── Types ────────────────────────────────────────────────────────────────────

export type McpError = { code: number; message: string; data?: unknown };

export type McpResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: McpError;
};

type ToolInputSchema = {
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
};

type Tool = { name: string; description: string; inputSchema: ToolInputSchema };

// ── Tool registry ────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'get_risk_level',
    description:
      'Map a Tydro health factor to a risk band (Conservative / Balanced / Aggressive / At Risk) with color and description.',
    inputSchema: {
      type: 'object',
      properties: {
        healthFactor: {
          type: 'number',
          description: 'Position health factor; pass the string "Infinity" when the user has no debt.',
        },
      },
      required: ['healthFactor'],
    },
  },
  {
    name: 'get_tydro_overview',
    description:
      'Live Tydro protocol overview on Ink: total supplied (TVL), borrows, utilization, available liquidity, and per-reserve supply/borrow/APY.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_tydro_position',
    description:
      'Live Tydro position for an address on Ink: collateral, debt, and health factor. Returns null when the address has no position.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Ethereum address (0x + 40 hex chars) on Ink.' },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_ink_ecosystem',
    description:
      'Ink ecosystem overview: TVL and 24h data for Tydro (on-chain RPC), Nado (indexer), and third-party protocols (Veda, Sentora, Velodrome, Uniswap V4, Curve, Morpho Blue) via DefiLlama.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_nado_stats',
    description:
      'Nado perps market stats: top pairs by 24h volume with price, change and open interest, plus total 24h volume.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max pairs to return (default 8, max 20).' },
      },
    },
  },
  {
    name: 'get_key_metrics',
    description:
      'Dashboard key metrics: Tydro TVL, total borrows and utilization, plus Nado 24h volume.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function error(code: number, message: string, data?: unknown): McpError {
  return { code, message, ...(data !== undefined ? { data } : {}) };
}

function isMcpError(err: unknown): err is McpError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as McpError).code === 'number' &&
    typeof (err as McpError).message === 'string'
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tool timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseHealthFactor(raw: unknown): number {
  if (typeof raw === 'number') {
    if (Number.isFinite(raw) && raw > 0) return raw;
    throw error(-32602, "Invalid params: 'healthFactor' must be a positive number or 'Infinity'");
  }
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase();
    if (lower === 'infinity' || lower === 'inf') return Infinity;
  }
  throw error(-32602, "Invalid params: 'healthFactor' must be a positive number or 'Infinity'");
}

function parseAddress(raw: unknown): string {
  if (typeof raw !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    throw error(
      -32602,
      "Invalid params: 'address' must be a valid Ethereum address (0x + 40 hex chars)"
    );
  }
  return raw;
}

function parseLimit(raw: unknown): number {
  if (raw === undefined) return 8;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw error(-32602, "Invalid params: 'limit' must be a number");
  }
  return Math.min(Math.max(Math.floor(raw), 1), 20);
}

// ── Tool handlers (all read-only, reuse existing lib services) ───────────────

const HANDLERS: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  async get_risk_level(params) {
    return getRiskLevel(parseHealthFactor(params.healthFactor));
  },

  async get_tydro_overview() {
    return fetchTydroOverview();
  },

  async get_tydro_position(params) {
    return fetchTydroUserPosition(parseAddress(params.address));
  },

  async get_ink_ecosystem() {
    return fetchEcosystemOverview();
  },

  async get_nado_stats(params) {
    const pairs = await fetchNadoTopPairs(parseLimit(params.limit));
    const totalVolume24hUsd = pairs.reduce((sum, p) => sum + p.volume, 0);
    const totalOpenInterestUsd = pairs.reduce((sum, p) => sum + (p.openInterestUsd ?? 0), 0);
    return { pairs, totalVolume24hUsd, totalOpenInterestUsd };
  },

  async get_key_metrics() {
    const [overview, tickers] = await Promise.all([fetchTydroOverview(), getNadoTickers()]);
    let nadoVolume24hUsd = 0;
    tickers.forEach((t) => {
      nadoVolume24hUsd += t.volume;
    });
    return {
      tvlUsd: overview.tvlUsd,
      totalBorrowUsd: overview.totalBorrowUsd,
      utilization: overview.utilization,
      nadoVolume24hUsd,
    };
  },
};

// ── JSON-RPC 2.0 dispatch ────────────────────────────────────────────────────

/**
 * Handle one JSON-RPC 2.0 request body. Returns null for notifications (no
 * id — the caller should respond with an empty 202). Batches are rejected
 * with -32600 (this server is intentionally single-request only).
 */
export async function handleMcpRequest(body: unknown): Promise<McpResponse | null> {
  if (!isObject(body)) {
    return {
      jsonrpc: '2.0',
      id: null,
      error: error(-32600, 'Invalid Request: expected a JSON-RPC 2.0 request object'),
    };
  }

  const id = typeof body.id === 'string' || typeof body.id === 'number' ? body.id : null;
  const method = typeof body.method === 'string' ? body.method : '';
  const params = isObject(body.params) ? body.params : {};

  if (body.jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: error(-32600, "Invalid Request: 'jsonrpc' must be '2.0'") };
  }

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
        },
      };

    case 'notifications/initialized':
      // Notifications carry no id and expect no response body.
      return id === null ? null : { jsonrpc: '2.0', id, result: {} };

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : '';
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) {
        return { jsonrpc: '2.0', id, error: error(-32602, `Unknown tool: '${name}'`) };
      }
      const handler = HANDLERS[name];
      if (!handler) {
        return { jsonrpc: '2.0', id, error: error(-32601, `No handler for tool: '${name}'`) };
      }
      const args = isObject(params.arguments) ? params.arguments : {};
      try {
        const result = await withTimeout(handler(args), TOOL_TIMEOUT_MS);
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        };
      } catch (err) {
        if (isMcpError(err)) return { jsonrpc: '2.0', id, error: err };
        return {
          jsonrpc: '2.0',
          id,
          error: error(-32603, 'Internal error', err instanceof Error ? err.message : String(err)),
        };
      }
    }

    default:
      return { jsonrpc: '2.0', id, error: error(-32601, `Method not found: '${method}'`) };
  }
}
