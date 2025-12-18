import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Configure body size limit for middleware and API routes
    proxyClientMaxBodySize: 52428800, // 50MB in bytes
  },
};

export default nextConfig;
