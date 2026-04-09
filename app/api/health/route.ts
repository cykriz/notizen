import { NextResponse } from 'next/server';

// POST instead of GET so the service worker doesn't cache the response.
// SW only caches GET requests — POST always goes to the network.
export function POST() {
  return NextResponse.json({ app: 'notizen' });
}
