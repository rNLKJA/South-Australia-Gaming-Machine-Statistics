import type { NextConfig } from "next"

/**
 * Content security policy. connect-src is the guarantee behind bring-your-own-key: scripts on this
 * site can only talk to this site, the OpenFreeMap tiles and the two AI providers' APIs, so a
 * visitor's key can't be sent anywhere else.
 */
const CSP = [
  "connect-src 'self' https://tiles.openfreemap.org https://api.anthropic.com https://api.openai.com",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // the markdown under web/content is read at build time by the /methods pages
  outputFileTracingIncludes: { "/methods/**": ["./content/**"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/vendor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ]
  },
}

export default nextConfig
