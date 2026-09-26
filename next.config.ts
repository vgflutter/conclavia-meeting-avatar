import path from 'node:path';
import type { NextConfig } from "next";

function publicDevelopmentHost(): string[] {
  if (process.env.NODE_ENV === "production" || !process.env.CONCLAVIA_PUBLIC_URL) {
    return [];
  }

  try {
    return [new URL(process.env.CONCLAVIA_PUBLIC_URL).hostname];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ['@conclavia/avatar-kit'],
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  outputFileTracingIncludes: { '/avatars/host-v1/*': ['./node_modules/@conclavia/avatar-kit/assets/host-v1/*', '../conclavia-avatar-kit/assets/host-v1/*'], '/avatars/rigged-v1/*': ['./node_modules/@conclavia/avatar-kit/assets/**/*', '../conclavia-avatar-kit/assets/**/*'] },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", ...publicDevelopmentHost()],
  devIndicators: false,
  turbopack: {
    root: path.resolve(process.cwd(), '..'),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
