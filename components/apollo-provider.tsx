'use client';

import { ApolloProvider as ApolloClientProvider } from '@apollo/client/react';
import { useMemo, type ReactNode } from 'react';
import { createApolloClient } from '@/lib/apollo-client';

export function ApolloProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createApolloClient(), []);
  return <ApolloClientProvider client={client}>{children}</ApolloClientProvider>;
}
