import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Hide the dev-only route badge (errors still show).
  devIndicators: false,
  // Basic hardening: no framing (clickjacking), no MIME sniffing, private referrers.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // Soul Card fonts are read from disk at runtime, so make sure they ship.
  outputFileTracingIncludes: {
    "/api/card/*": ["src/assets/fonts/**/*"],
    "/chog/*": ["src/assets/fonts/**/*"],
    "/": ["src/assets/fonts/**/*"],
    "/*": ["src/assets/fonts/**/*"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
