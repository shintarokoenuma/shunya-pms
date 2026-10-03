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
  // B-205 PR-3: dev の Server Function のログ（「└─ ƒ resetPassword({...}) in …ms」）に引数が出るので止める。
  // パスワード・トークン・メールアドレスを引数に取る action があるため。本番（next start）はもともと出ない
  // （node_modules/next/dist/server/app-render/action-handler.js: NODE_ENV === 'development' のときだけ）。
  logging: {
    serverFunctions: false,
  },
};

export default nextConfig;
