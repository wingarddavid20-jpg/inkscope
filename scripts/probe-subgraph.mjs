// Dev tool: introspects the Tydro subgraph on Goldsky and prints the schema
// types we care about (reserve/user/market/position/price entities). Reads the
// endpoint from NEXT_PUBLIC_GRAPHQL_ENDPOINT in .env.local at runtime.
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const endpointMatch = env.match(/^NEXT_PUBLIC_GRAPHQL_ENDPOINT=(.*)$/m);
const endpoint = endpointMatch?.[1]?.trim();

if (!endpoint) {
  console.error('NEXT_PUBLIC_GRAPHQL_ENDPOINT missing in .env.local');
  process.exit(1);
}

const introspectionQuery = `
  query Introspection {
    __schema {
      types {
        name
        kind
        fields(includeDeprecated: true) {
          name
          args { name type { kind name ofType { kind name ofType { kind name } } } }
          type {
            kind
            name
            ofType { kind name ofType { kind name ofType { kind name } } }
          }
        }
      }
    }
  }
`;

async function main() {
  console.log(`\n== Endpoint: ${endpoint.replace(/^https?:\/\//, '')} ==\n`);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: introspectionQuery }),
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText}`);
    console.error((await res.text()).slice(0, 2000));
    process.exit(1);
  }
  const json = await res.json();
  if (json.errors) {
    console.error('Introspection errors:', JSON.stringify(json.errors, null, 2).slice(0, 4000));
    process.exit(1);
  }

  const types = json.data.__schema.types.filter(
    (t) =>
      !t.name.startsWith('__') &&
      /reserve|user|market|position|price|supply|borrow|oracle|asset/i.test(t.name)
  );

  console.log(`Schema types matching interest (${types.length}):\n`);
  for (const t of types.sort((a, b) => a.name.localeCompare(b.name))) {
    const fields = (t.fields ?? [])
      .map((f) => {
        const t = f.type;
        const tName = t.name ?? t.ofType?.name ?? t.ofType?.ofType?.name ?? t.ofType?.ofType?.ofType?.name ?? '?';
        const depth =
          (t.ofType ? 1 : 0) + (t.ofType?.ofType ? 1 : 0) + (t.ofType?.ofType?.ofType ? 1 : 0);
        return `${f.name}: ${'['.repeat(depth)}${tName}${']'.repeat(depth)}`;
      })
      .join('\n    ');
    console.log(`${t.kind} ${t.name}\n    ${fields || '(no fields)'}\n`);
  }
}

main().catch((err) => {
  console.error('Probe failed:', err.message);
  process.exit(1);
});
