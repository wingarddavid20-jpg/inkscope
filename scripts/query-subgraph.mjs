// Dev tool: runs an ad-hoc GraphQL query against the Tydro subgraph on Goldsky.
// Usage:
//   node scripts/query-subgraph.mjs "{ reserves { symbol utilizationRate } }"
//   node scripts/query-subgraph.mjs "{ reserve(id: \"0x...\") { symbol } }" '{"var": "value"}'
// Reads the endpoint from NEXT_PUBLIC_GRAPHQL_ENDPOINT in .env.local at runtime.
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const endpoint = env.match(/^NEXT_PUBLIC_GRAPHQL_ENDPOINT=(.*)$/m)?.[1]?.trim();

if (!endpoint) {
  console.error('NEXT_PUBLIC_GRAPHQL_ENDPOINT missing in .env.local');
  process.exit(1);
}

const [query, variablesArg] = process.argv.slice(2);

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
