import { execSync } from "node:child_process"

import type { NextConfig } from "next"

/**
 * Content security policy. It limits where this site's pages can load code from and send data
 * to: scripts, styles, fonts and workers only from this site; fetch-style connections only to this
 * site, the OpenFreeMap tiles and the two AI providers' APIs; images only from this site and the
 * tiles; no frames, plugins or form posts elsewhere. That narrows the ways a visitor's key could
 * leave the browser for anywhere other than the provider they chose, but it is one layer of
 * defence, not a guarantee: it can't protect against code the site itself serves.
 *
 * 'unsafe-inline' is needed for Next's inline bootstrap scripts and for inline chart styles (the
 * pages are static, so there is no per-request nonce); 'wasm-unsafe-eval' lets sql.js compile its
 * WebAssembly. `next dev` also needs 'unsafe-eval' for fast refresh, so it is added in development
 * only. Vercel's preview toolbar is blocked by this policy on preview deployments.
 */
const DEV = process.env.NODE_ENV === "development"

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `connect-src 'self' https://tiles.openfreemap.org https://api.anthropic.com https://api.openai.com${DEV ? " ws:" : ""}`,
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

/**
 * The build's short commit, logged with every AI call (lib/ai/prompt-fingerprint.ts): an explicit
 * NEXT_PUBLIC_APP_VERSION (CLI deploys pass it with --build-env), Vercel's VERCEL_GIT_COMMIT_SHA,
 * the local checkout's HEAD, or "dev".
 */
function appVersion(): string {
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  } catch {
    return "dev"
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion() },
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
