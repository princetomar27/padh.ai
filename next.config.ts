import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Default is 10MB. Admin PDF uploads go through Clerk middleware; larger bodies
   * make req.formData() throw → "Invalid form data" unless this is raised.
   * Keep ≥ upload route MAX_BYTES (~55MB).
   */
  experimental: {
    middlewareClientMaxBodySize: "60mb",
  },

  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],

  // ─── Temporary: Phase 2 Clerk migration ────────────────────────────────────
  // Old Samvaad modules (meetings, agents, call, premium) still have source files
  // with imports from packages that have been removed (Stream.io, Better Auth).
  // Their page.tsx wrappers are all commented-out stubs so they don't run at
  // runtime. TypeScript still checks every file under src/ though, so we
  // suppress build-time type errors here while we rewrite those modules in
  // Phase 3+. Remove this once all old modules have been replaced.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ───────────────────────────────────────────────────────────────────────────

  // Suppress development warnings
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
