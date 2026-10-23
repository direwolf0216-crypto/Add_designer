import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Fully prefetched pages (the sidebar's, the Jobs tabs) open instantly from the client cache; keep
    // that cache to 30 s (default 5 min) so a switch never shows data more than half a minute old.
    staleTimes: { static: 30 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // The jobs pages were merged into one workspace at /jobs (board / list / schedule, my / all).
    return [
      { source: '/jobs/job-status', destination: '/jobs', permanent: true },
      { source: '/jobs/overview', destination: '/jobs', permanent: true },
      { source: '/jobs/allJobs', destination: '/jobs?view=list', permanent: true },
      { source: '/jobs/upcoming', destination: '/jobs?view=schedule', permanent: true },
      { source: '/jobs/my-jobs', destination: '/jobs?scope=mine', permanent: true },
      // Redirect before any page code runs (a redirect() during render cut off the session request).
      { source: '/transactions', destination: '/transactions/overview', permanent: false },
    ];
  },
};

export default nextConfig;
