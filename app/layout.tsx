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
  metadataBase: new URL('https://inkscope-one.vercel.app/'),
  title: 'InkScope — The Ink Ecosystem Dashboard',
  description:
    'Real-time on-chain analytics for Ink — track Tydro lending, Nado perpetuals, and ecosystem liquidity flows.',
  openGraph: {
    type: 'website',
    url: 'https://inkscope-one.vercel.app/',
    siteName: 'InkScope',
    title: 'InkScope — The Ink Ecosystem Dashboard',
    description:
      'Real-time on-chain analytics for Ink — track Tydro lending, Nado perpetuals, and ecosystem liquidity flows.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'InkScope — The Ink Ecosystem Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InkScope — The Ink Ecosystem Dashboard',
    description: 'Real-time on-chain analytics for Ink.',
    images: ['/og.png'],
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
