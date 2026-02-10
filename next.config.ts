import type { NextConfig } from "next";

const allowedOrigins: string[] = [
  'http://127.0.0.1:5000',
  'http://localhost:5000',
  'http://0.0.0.0:5000',
];
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
  allowedDevOrigins: allowedOrigins,
  output: 'standalone',
};

export default nextConfig;
