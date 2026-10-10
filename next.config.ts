import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Hide the dev-only route badge (errors still show).
  devIndicators: false,
  // Soul Card fonts are read from disk at runtime, so make sure they ship.
  outputFileTracingIncludes: {
    "/api/card/*": ["src/assets/fonts/**/*"],
    "/chog/*": ["src/assets/fonts/**/*"],
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
