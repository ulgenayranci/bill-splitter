import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  env: {
    // Pin guest links to the production domain so old deployment URLs
    // don't send guests to stale code. VERCEL_PROJECT_PRODUCTION_URL is
    // set automatically by Vercel on every deployment (no dashboard config needed).
    NEXT_PUBLIC_APP_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['192.168.1.129'],
};

export default nextConfig;
