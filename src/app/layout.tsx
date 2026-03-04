import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { BridgeProvider } from './context/BridgeContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'THE BRIDGE - Mission Control',
  description: 'Real-time Agent Communication Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-mono bg-bridge-bg text-bridge-text overflow-hidden`}>
        <BridgeProvider>
          {children}
        </BridgeProvider>
      </body>
    </html>
  );
}
