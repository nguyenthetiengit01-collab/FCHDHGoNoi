import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx"],
  outputFileTracingIncludes: {
    "/": ["./data/**/*"],
    "/api/**/*": ["./data/**/*"],
  },
};

export default nextConfig;

