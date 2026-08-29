import type { Metadata } from 'next';
import { BuildersPage } from '@/components/builders-page';

export const metadata: Metadata = {
  title: 'Builders — InkBoard',
  description:
    'Proof of work from the Ink community — builder spotlight, community profiles, and how to launch your app on Ink.',
};

export default function BuildersRoute() {
  return <BuildersPage />;
}
