import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Where `next dev` sends API calls: a running bridge (see the README).
const bridgeUrl = process.env.BRIDGE_URL ?? "http://localhost:8098";

const nextConfig: NextConfig = {
  // Production: a static export (out/) that the bridge serves itself, on the
  // same origin as its API. No Next.js server at runtime.
  output: isDev ? undefined : "export",
  images: { unoptimized: true },
  ...(isDev && {
    async rewrites() {
      return [{ source: "/api/:path*", destination: `${bridgeUrl}/api/:path*` }];
    },
  }),
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
