import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Proxy buffers request bodies before forwarding; default cap is 10 MB.
    // Raise this so large file uploads (audio/video attachments) pass through intact.
    proxyClientMaxBodySize: 500 * 1024 * 1024, // 500 MB
  },
};

export default withSerwist(nextConfig);
