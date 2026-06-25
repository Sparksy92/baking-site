import type { NextConfig } from 'next';

const API_URL = process.env.API_URL || 'http://localhost:8100';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/images/uploads/:path*', destination: `${API_URL}/images/uploads/:path*` },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*' },
    ],
  },
};

export default nextConfig;

