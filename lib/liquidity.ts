// ─────────────────────────────────────────────────────────────────────────────
// Liquidity flow — bridge + CEX capital movements into/out of Ink.
//
// Data source: the Goldsky subgraph endpoint. The endpoint is resolved from
// NEXT_PUBLIC_GOLDSKY_ENDPOINT (alias, per the dashboard env convention) or
// NEXT_PUBLIC_GRAPHQL_ENDPOINT (the existing var used by the Tydro panel).
//
// ⚠ DATA AVAILABILITY: as of 2026-08-28 this endpoint serves the Tydro
// (Aave V3 lending) subgraph, whose schema has NO bridge/CEX transfer
// entities (verified via introspection). To avoid firing a broken query every
// poll, fetchLiquidityFlows() first checks the deployed schema for the flow
// entities and only aggregates once they exist. Until then it resolves with
// { available: false, reason: 'unsupported' } and the panel renders "N/A" —
// never mock data.
//
// Schema contract the flow subgraph must expose (deploy it to the same
// Goldsky project and the panel lights up with no code changes):
//   type BridgeTransfer { id: ID!, amountUsd: BigDecimal!, direction: Direction!,
//                         timestamp: BigInt!, token: Bytes }
//   type CexTransfer    { id: ID!, amountUsd: BigDecimal!, direction: Direction!,
//                         timestamp: BigInt!, token: Bytes }
//   enum Direction { inbound, outbound }
//   // CEX mapping: deposits = inbound, withdrawals = outbound
// ─────────────────────────────────────────────────────────────────────────────

export type FlowDirection = 'inbound' | 'outbound';

export type LiquidityFlowData = {
  /** Bridge volume entering Ink (USD). */
  inboundBridgeUsd: number;
  /** Bridge volume leaving Ink (USD). */
  outboundBridgeUsd: number;
  /** inbound − outbound (USD). */
  netBridgeUsd: number;
  /** CEX deposits into Ink (USD). */
  cexDepositsUsd: number;
  /** CEX withdrawals out of Ink (USD). */
  cexWithdrawalsUsd: number;
  /** deposits − withdrawals (USD). */
  netCexUsd: number;
  /** Start of the aggregation window (epoch ms). */
  windowStart: number;
  /** Aggregation window length (hours). */
  windowHours: number;
  updatedAt: number;
};

export type LiquidityResult =
  | { available: true; data: LiquidityFlowData }
  | { available: false; reason: 'unsupported' | 'error'; message: string };

/** Rolling aggregation window for the flow volumes. */
const WINDOW_HOURS = 24;

/** Entity names the deployed schema must expose for flow aggregation. */
const REQUIRED_ENTITIES = ['BridgeTransfer', 'CexTransfer'];

/** Resolves the Goldsky endpoint (NEXT_PUBLIC_GOLDSKY_ENDPOINT wins, then the existing var). */
export function getLiquidityEndpoint(): string {
  return (
    process.env.NEXT_PUBLIC_GOLDSKY_ENDPOINT ??
    process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ??
    ''
  );
}

// Schema capability check is memoized per page load (the subgraph deployment
// doesn't change mid-session; a refresh re-runs it).
let schemaChecked = false;
let schemaOk = false;

type GraphQlResponse<T> = { data?: T | null; errors?: { message?: string }[] | null };

async function postGraphql<T>(
  endpoint: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQlResponse<T>> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const json = (await res.json()) as GraphQlResponse<T>;
  if (!res.ok) throw new Error(`Goldsky responded with HTTP ${res.status}`);
  return json;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

/** Introspects the deployed schema for the flow entities (once per session). */
async function hasFlowSchema(endpoint: string): Promise<boolean> {
  if (schemaChecked) return schemaOk;

  const json = await postGraphql<{
    __schema?: { types?: { name?: string }[] | null } | null;
  }>(endpoint, '{ __schema { types { name } } }');

  if (json.errors) {
    throw new Error(json.errors[0]?.message ?? 'Schema introspection failed');
  }

  const names = new Set((json.data?.__schema?.types ?? []).map((t) => t.name ?? ''));
  schemaOk = REQUIRED_ENTITIES.every((name) => names.has(name));
  schemaChecked = true;
  return schemaOk;
}

type FlowNode = { amountUsd?: string | null; direction?: string | null };
type FlowsResponse = { bridgeTransfers?: FlowNode[] | null; cexTransfers?: FlowNode[] | null };

function sumByDirection(
  nodes: FlowNode[] | null | undefined,
  direction: FlowDirection
): number {
  if (!nodes) return 0;
  return nodes.reduce((sum, node) => {
    if (node.direction !== direction) return sum;
    const value = Number(node.amountUsd);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function aggregateFlows(
  flows: FlowsResponse,
  windowStart: number
): LiquidityFlowData {
  const inboundBridgeUsd = sumByDirection(flows.bridgeTransfers, 'inbound');
  const outboundBridgeUsd = sumByDirection(flows.bridgeTransfers, 'outbound');
  const cexDepositsUsd = sumByDirection(flows.cexTransfers, 'inbound');
  const cexWithdrawalsUsd = sumByDirection(flows.cexTransfers, 'outbound');

  return {
    inboundBridgeUsd,
    outboundBridgeUsd,
    netBridgeUsd: inboundBridgeUsd - outboundBridgeUsd,
    cexDepositsUsd,
    cexWithdrawalsUsd,
    netCexUsd: cexDepositsUsd - cexWithdrawalsUsd,
    windowStart,
    windowHours: WINDOW_HOURS,
    updatedAt: Date.now(),
  };
}

/**
 * Fetches bridge + CEX flow volumes from the Goldsky subgraph, aggregated
 * over the trailing 24h window. Never fabricates data: when the deployed
 * schema lacks the flow entities (current state), or the endpoint is down,
 * it resolves with `available: false` so the UI can render N/A.
 */
export async function fetchLiquidityFlows(): Promise<LiquidityResult> {
  const endpoint = getLiquidityEndpoint();
  if (!endpoint) {
    return {
      available: false,
      reason: 'error',
      message: 'No Goldsky endpoint configured (NEXT_PUBLIC_GRAPHQL_ENDPOINT).',
    };
  }

  try {
    if (!(await hasFlowSchema(endpoint))) {
      return {
        available: false,
        reason: 'unsupported',
        message:
          'This subgraph does not index BridgeTransfer / CexTransfer entities yet.',
      };
    }
  } catch (err) {
    return { available: false, reason: 'error', message: errorMessage(err) };
  }

  const now = Date.now();
  const sinceSec = Math.floor((now - WINDOW_HOURS * 3_600_000) / 1000);

  try {
    const json = await postGraphql<FlowsResponse>(
      endpoint,
      `query LiquidityFlows($bridgeSince: BigInt!, $cexSince: BigInt!) {
        bridgeTransfers(first: 1000, where: { timestamp_gte: $bridgeSince }) {
          amountUsd
          direction
        }
        cexTransfers(first: 1000, where: { timestamp_gte: $cexSince }) {
          amountUsd
          direction
        }
      }`,
      { bridgeSince: sinceSec.toString(), cexSince: sinceSec.toString() }
    );

    if (json.errors) {
      return {
        available: false,
        reason: 'error',
        message: json.errors[0]?.message ?? 'Liquidity flow query failed',
      };
    }

    if (!json.data) {
      return { available: false, reason: 'error', message: 'Empty response from Goldsky' };
    }

    return {
      available: true,
      data: aggregateFlows(json.data, now - WINDOW_HOURS * 3_600_000),
    };
  } catch (err) {
    return { available: false, reason: 'error', message: errorMessage(err) };
  }
}
