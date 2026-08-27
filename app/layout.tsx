import './globals.css';
import type { Metadata } from 'next';
import { Space_Grotesk, Fraunces } from 'next/font/google';
import { ApolloProvider } from '@/components/apollo-provider';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ink — Builder Dashboard',
  description:
    'On-chain analytics for the Ink blockchain. Track Tydro & Nado protocols — TVL, volume, positions, and the builders shipping on top.',
  openGraph: {
    title: 'Ink — Builder Dashboard',
    description:
      'On-chain analytics for the Ink blockchain. Track Tydro & Nado protocols.',
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${fraunces.variable} font-body antialiased`}
      >
        <ApolloProvider>{children}</ApolloProvider>
      </body>
    </html>
  );
}
