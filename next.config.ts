import type { NextConfig } from "next";
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',                  // PWA assets generation folder
  disable: process.env.NODE_ENV === 'development', // Disable in dev to avoid hot-reload cache interference
  register: true,                  // Automatically registers the service worker script
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true, // Recommended alongside skipWaiting to take immediate control
  },               // Forces updated service workers to take over instantly
  cacheOnFrontEndNav: true,        // Aggressively pre-caches pages visited via client-side <Link> components
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true            // Auto-reloads UI when internet recovers to run sync pipes
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.8'],
  reactStrictMode: true,
  turbopack: {},
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

export default withPWA(nextConfig);
