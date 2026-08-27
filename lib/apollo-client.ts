// Client-side Apollo Client for the Tydro subgraph (Goldsky).
// The endpoint is inlined from NEXT_PUBLIC_GRAPHQL_ENDPOINT at build time.
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

export function createApolloClient() {
  const uri = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ?? '';

  if (!uri) {
    console.warn(
      'NEXT_PUBLIC_GRAPHQL_ENDPOINT is not set — Tydro subgraph queries will fail and the panel falls back to RPC.'
    );
  }

  return new ApolloClient({
    link: createHttpLink({
      uri,
      fetchOptions: { cache: 'no-store' },
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' },
      query: { fetchPolicy: 'network-only' },
    },
  });
}
