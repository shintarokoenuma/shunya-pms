import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // サーバ専用パッケージはバンドルせず外部扱いにする
  // （@react-pdf/renderer=S-4c-2 / @google-cloud/storage=B-053）。
  serverExternalPackages: ["@react-pdf/renderer", "@google-cloud/storage"],
};

export default nextConfig;
