import { NextResponse } from 'next/server';
import { handleMcpRequest } from '@/lib/mcp-server';

// MCP tools talk to the chain / indexers — must run in the Node runtime.
export const runtime = 'nodejs';
// Always handle requests live; this endpoint is stateless JSON-RPC.
export const dynamic = 'force-dynamic';

// Public, read-only endpoint for AI agents — CORS wide open.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Method not allowed. Use POST with a JSON-RPC 2.0 body.' },
    },
    { status: 405, headers: CORS_HEADERS }
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: request body is not valid JSON' },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const response = await handleMcpRequest(body);

  if (response === null) {
    // Notification (no id) — acknowledge with an empty body.
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  return NextResponse.json(response, { status: 200, headers: CORS_HEADERS });
}
