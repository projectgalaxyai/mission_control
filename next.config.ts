import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  async rewrites() {
    return [
      {
        source: '/api/bridge/:path*',
        destination: 'http://localhost:3001/:path*'
      },
      { source: '/favicon.ico', destination: '/vercel.svg' }
    ]
  }
};

export default nextConfig;
