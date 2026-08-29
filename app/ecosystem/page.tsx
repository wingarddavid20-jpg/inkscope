import type { Metadata } from 'next';
import { EcosystemPage } from '@/components/ecosystem-page';

export const metadata: Metadata = {
  title: 'Ecosystem — InkBoard',
  description:
    'Live TVL and 24h volume across the top protocols building on Ink — Tydro lending, Nado perps, and the wider ecosystem.',
};

export default function EcosystemRoute() {
  return <EcosystemPage />;
}
