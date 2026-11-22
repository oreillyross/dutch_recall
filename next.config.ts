import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// Shown on the Usage tab. Production deploys run from the release workflow (`vercel build` on a GitHub runner at a
// v* tag), so the tag is the build number. Falls back to GitHub/Vercel env vars, then "dev".
const buildRef = git("describe --tags --always") || process.env.GITHUB_REF_NAME || "dev";
const buildSha = (git("rev-parse --short HEAD") || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_BUILD_REF: buildRef,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Tell browsers to use HTTPS only for this host (ignored over plain HTTP, so harmless on localhost).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        // The service worker must never be served stale, or updates won't reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
