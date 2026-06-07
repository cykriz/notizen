import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Middleware buffers request bodies before forwarding; default cap is 10 MB.
    // Raise this so large file uploads (audio/video attachments) pass through intact.
    middlewareClientMaxBodySize: 100 * 1024 * 1024, // 100 MB
  },
};

export default withSerwist(nextConfig);
