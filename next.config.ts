import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Keeps the Docker image small when this ships to the VPS.
  output: "standalone",
};

export default withNextIntl(nextConfig);
