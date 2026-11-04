import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Capacitor WebView loads the production site; keep HTML fresh so
  // new deploys (hashed chunks) are picked up without a native rebuild.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
