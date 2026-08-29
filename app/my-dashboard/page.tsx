import type { Metadata } from 'next';
import { MyDashboardPage } from '@/components/my-dashboard-page';

export const metadata: Metadata = {
  title: 'My Dashboard — InkBoard',
  description:
    'Your wallet-scoped portfolio on Ink — Tydro position, Nado trades, and on-chain activity.',
};

export default function MyDashboardRoute() {
  return <MyDashboardPage />;
}
