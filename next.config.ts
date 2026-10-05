import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // The demos are single-page apps in /public/demos/*: deep links such as /demos/hrms/employees
    // have no file of their own, so they fall back to its index.html (real files are served first).
    return {
      fallback: [
        { source: "/demos/hrms/:path*", destination: "/demos/hrms/index.html" },
        { source: "/demos/pos/:path*", destination: "/demos/pos/index.html" },
      ],
    };
  },
};

export default nextConfig;
