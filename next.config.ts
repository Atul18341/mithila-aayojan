import type { NextConfig } from "next";
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',                  // Specifies where the service worker files will be generated
  disable: process.env.NODE_ENV === 'development', // Disable in development to avoid aggressive caching loops
  register: true,                  // Automatically register the service worker
  sw:'sw.js'
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.8'],
  turbopack: {}, 

};

export default withPWA(nextConfig);
