import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.7'],

  async rewrites() {
    return [
      {
        // 1. Intercept any incoming requests hitting your website's asset path
        source: '/assets/:path*',
        // 2. Secretly proxy the payload stream from your active Cloudflare Worker node
        destination: 'https://assets-aayojan.lyssstartup24.workers.dev/:path*',
      },
    ];
  },
};

export default nextConfig;
