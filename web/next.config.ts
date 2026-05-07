import type { NextConfig } from "next";

// When deploying to GitHub Pages we serve from a sub-path like
// `/yardstick-demo/`. Locally we want the app at `/`. The CI workflow sets
// NEXT_PUBLIC_BASE_PATH; dev/local builds leave it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  webpack: (config) => {
    config.module.rules.push({ test: /\.rs$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
