import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel Deployment Configuration */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
