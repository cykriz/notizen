import { createSerwistRoute } from '@serwist/turbopack';
import type { NextRequest } from 'next/server';

// An empty SW_BUILD_ID must fall back too (see next.config.ts). Explicit check
// rather than `||` for the strict-boolean / prefer-nullish lint rules.
const envBuildId = process.env.SW_BUILD_ID;
const buildId = envBuildId !== undefined && envBuildId !== '' ? envBuildId : 'dev';

const serwistRoute = createSerwistRoute({
  swSrc: 'worker/sw.ts',
  esbuildOptions: {
    define: {
      'process.env.SW_BUILD_ID': JSON.stringify(buildId),
    },
  },
});

export const { dynamic, dynamicParams, revalidate } = serwistRoute;

export async function generateStaticParams() {
  const params = await serwistRoute.generateStaticParams();
  return params.map(({ path }) => ({ path: path.split('/') }));
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const response = await serwistRoute.GET(request, { params: Promise.resolve({ path: path.join('/') }) });

  // Allow the SW (served from /serwist/sw.js) to control the root scope "/"
  if (path.join('/') === 'sw.js') {
    const headers = new Headers(response.headers);
    headers.set('Service-Worker-Allowed', '/');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  return response;
}
