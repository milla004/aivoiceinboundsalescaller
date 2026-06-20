import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal, self-contained server bundle for Docker/Coolify.
  output: "standalone",
};

export default nextConfig;
