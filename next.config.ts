import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer はサーバ専用。バンドルせず外部パッケージ扱いにする（S-4c-2）。
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
