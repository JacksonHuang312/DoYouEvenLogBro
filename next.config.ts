import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e suite (e2e/README.md) sets this so its dev server never fights a dev server you have open.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    instantInsights: {
      // Every page renders client-side behind Firebase Auth (the server only sees a
      // spinner), so default validation flags each one as a "dropped segment".
      // Only validate segments that opt in with `export const instant = true`.
      validationLevel: "manual-warning",
    },
  },
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
