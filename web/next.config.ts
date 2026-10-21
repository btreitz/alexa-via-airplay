import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const bridgeUrl = process.env.BRIDGE_URL ?? "http://localhost:8098";

const nextConfig: NextConfig = {
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
