import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // サーバ専用パッケージはバンドルせず外部扱いにする
  // （@react-pdf/renderer=S-4c-2 / @google-cloud/storage=B-053 / sharp=B-027 絵型サムネ生成）。
  serverExternalPackages: ["@react-pdf/renderer", "@google-cloud/storage", "sharp"],
  // QE-0c: マーキング原本PDF 添付（最大10MB）を Server Action で受けるため上限を引き上げる。
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
