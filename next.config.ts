import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';
import { randomUUID } from 'node:crypto';

// An empty SW_BUILD_ID (e.g. a Docker build with no --build-arg, which sets ENV
// to '') must also fall back, else the cache name becomes `pages-`. Explicit
// check rather than `||` to satisfy strict-boolean / prefer-nullish lint rules.
const envBuildId = process.env.SW_BUILD_ID;
const buildId = envBuildId !== undefined && envBuildId !== '' ? envBuildId : randomUUID();
process.env.SW_BUILD_ID = buildId;

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Proxy buffers request bodies before forwarding; default cap is 10 MB.
    // Raise this so large file uploads (audio/video attachments) pass through intact.
    proxyClientMaxBodySize: 500 * 1024 * 1024, // 500 MB
  },
  turbopack: {
    // The neural TTS engine (@diffusionstudio/vits-web) ships emscripten glue
    // that references Node built-ins (`fs`/`path`/`crypto`) inside dead
    // Node-only branches. Stub them to an empty module in the BROWSER bundle
    // only; server code keeps the real modules via the default condition.
    resolveAlias: {
      fs: { browser: './lib/emptyModule.ts' },
      path: { browser: './lib/emptyModule.ts' },
      crypto: { browser: './lib/emptyModule.ts' },
    },
  },
  generateBuildId: () => buildId,
};

export default withSerwist(nextConfig);
