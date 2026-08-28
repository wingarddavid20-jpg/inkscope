// Dev tool: runs an ad-hoc GraphQL query against an Inkscope subgraph on Goldsky.
// Usage:
//   node scripts/query-subgraph.mjs "{ reserves { symbol utilizationRate } }"
//   node scripts/query-subgraph.mjs "{ reserve(id: \"0x...\") { symbol } }" '{"var": "value"}'
//   node scripts/query-subgraph.mjs "{ bridgeTransfers(first: 5) { id } }" "" "https://.../gn"
// Endpoint resolution: optional 3rd arg > NEXT_PUBLIC_GOLDSKY_ENDPOINT > NEXT_PUBLIC_GRAPHQL_ENDPOINT.
// Reads .env.local at runtime.
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const envEndpoint =
  env.match(/^NEXT_PUBLIC_GOLDSKY_ENDPOINT=(.*)$/m)?.[1]?.trim() ??
  env.match(/^NEXT_PUBLIC_GRAPHQL_ENDPOINT=(.*)$/m)?.[1]?.trim();

const [query, arg2, arg3] = process.argv.slice(2);
let endpoint = envEndpoint;
let variablesArg;
if (arg2 && arg2.startsWith('http')) {
  endpoint = arg2; // endpoint passed without variables
} else {
  variablesArg = arg2;
  if (arg3) endpoint = arg3; // explicit endpoint as 3rd arg
}

if (!endpoint) {
  console.error('No endpoint: pass one as the 3rd arg or set NEXT_PUBLIC_GOLDSKY_ENDPOINT / NEXT_PUBLIC_GRAPHQL_ENDPOINT in .env.local');
  process.exit(1);
}

if (!query) {
  console.error('Usage: node scripts/query-subgraph.mjs "<graphql query>" ["<variables json>"]');
  process.exit(1);
}

let variables;
if (variablesArg) {
  try {
    variables = JSON.parse(variablesArg);
  } catch {
    console.error('Variables argument is not valid JSON:', variablesArg);
    process.exit(1);
  }
}

async function main() {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    console.error(`HTTP ${res.status}`);
    console.error(JSON.stringify(json.errors ?? json, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(json.data, null, 2));
}

main().catch((err) => {
  console.error('Query failed:', err.message);
  process.exit(1);
});
