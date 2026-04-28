import type { Metadata } from 'next';

// Override the root layout's PWA / app-icon metadata so anonymous viewers
// don't get prompted to install the app or load owner-only manifest assets.
// Metadata fields set to `null` here win over the parent's value.
export const metadata: Metadata = {
  manifest: null,
  appleWebApp: null,
  icons: null,
  other: {
    'mobile-web-app-capable': 'no',
  },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
