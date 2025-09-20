import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppress development warnings
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  productionBrowserSourceMaps: false,

  // TODO: check later
  // async redirects() {
  //   return [
  //     {
  //       source: "/",
  //       destination: "/meetings",
  //       permanent: true,
  //     },
  //   ];
  // },
};

export default nextConfig;
