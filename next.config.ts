import type { NextConfig } from "next";

const allowedOrigins: string[] = [];
if (process.env.REPLIT_DEV_DOMAIN) {
  allowedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}
if (process.env.REPLIT_DOMAINS) {
  process.env.REPLIT_DOMAINS.split(',').forEach((domain) => {
    allowedOrigins.push(`https://${domain.trim()}`);
  });
}

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: allowedOrigins.length > 0 ? allowedOrigins : undefined,
  output: 'standalone',
};

export default nextConfig;
