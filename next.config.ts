import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['whatsapp-web.js'],
  async redirects() {
    return [
      {
        source: '/jobs',
        destination: '/jobs/job-status',
        permanent: true,
      },
      {
        source: '/jobs/overview',
        destination: '/jobs/job-status',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
