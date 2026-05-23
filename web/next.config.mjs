import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (parent of `web/`). */
const repoRoot = path.resolve(__dirname, "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingRoot: repoRoot,
    serverComponentsExternalPackages: [
      "@clickhouse/client",
      "@mariozechner/pi-coding-agent",
      "@mariozechner/pi-agent-core",
      "@mariozechner/pi-ai",
      "tsx",
      "esbuild",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.craigslist.org" },
      { protocol: "https", hostname: "*.streeteasy.com" },
      { protocol: "https", hostname: "photos.zillowstatic.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
    ],
  },
  env: {
    REPO_ROOT: repoRoot,
  },
};

export default nextConfig;
