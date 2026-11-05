import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx"],
  outputFileTracingIncludes: {
    "/": ["./data/**/*"],
    "/api/**/*": ["./data/**/*"],
  },
  async rewrites() {
    return [
      {
        source: "/trai-nghiem",
        destination: "/trai-nghiem/index.html",
      },
    ];
  },
};

export default nextConfig;

