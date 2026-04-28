import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Notizen',
  description: 'Markdown-Notizen-App',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Notizen',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon-light-192.png', type: 'image/png', sizes: '192x192', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-192.png', type: 'image/png', sizes: '192x192', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/apple-touch-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de-DE" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
