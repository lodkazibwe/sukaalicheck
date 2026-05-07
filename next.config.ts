import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Static export only for production builds (npm run build).
  // Dev server runs as a normal Next.js app so dynamic route params work freely.
  ...(isProd && { output: "export" }),
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.10.115"],
};

export default nextConfig;
