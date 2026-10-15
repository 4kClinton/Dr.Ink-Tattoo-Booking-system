import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@drink/shared", "@drink/backend", "@drink/ui-tokens"],
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:prefix(c|t|f)/:token*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
