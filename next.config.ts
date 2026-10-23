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
    // Prefetched pages (the sidebar's, the Jobs tabs) open straight from the browser's cache for 5
    // minutes, with no round trip to the server (~0.35 s from India to the US region on every miss).
    // Pages shown from that cache refresh their figures in the background (SWR on Dashboard and
    // Daily Ledger, router.refresh on Jobs), so they stay current.
    staleTimes: { static: 300 },
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
