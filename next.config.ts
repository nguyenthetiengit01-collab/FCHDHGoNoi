import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy (enforced):
 * - Allows 'unsafe-inline' for Next.js 15 App Router static prerendering hydration scripts
 *   and Tailwind CSS v4 inline styles. Adopting strict nonce-based CSP requires middleware
 *   per-request nonces and dynamic rendering on public static routes, plus Preview smoke verification.
 * - Residual limitation: 'unsafe-inline' weakens XSS defense-in-depth; treat CSP here as
 *   a baseline framing/source restriction rather than full XSS mitigation.
 * - Allows 'unsafe-eval' only in development for React Fast Refresh / HMR.
 * - Allows data:/blob:/https: for WebP data URLs, QR codes, and Vercel Blob media assets.
 * - Restricts framing (frame-ancestors 'none') and plugins (object-src 'none').
 */
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

