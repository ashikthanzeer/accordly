import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const rawBackendUrl = process.env.BACKEND_API_URL?.trim();

    // Guard: When BACKEND_API_URL is missing or empty, do not rewrite (run local /api routes)
    if (!rawBackendUrl) {
      return [];
    }

    const backendUrl = rawBackendUrl.replace(/\/+$/, "");

    // Guard: Prevent self-referential loop if BACKEND_API_URL equals current host
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")
      .trim()
      .replace(/\/+$/, "");

    if (appUrl && backendUrl === appUrl) {
      return [];
    }

    // Use beforeFiles to ensure Vercel proxies /api/* requests to Render
    // taking precedence over any local App Router /api route files.
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
