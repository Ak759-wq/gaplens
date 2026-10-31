import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // pdf-parse pulls in pdfjs; keep it out of the server bundle and load it from node_modules at runtime.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
