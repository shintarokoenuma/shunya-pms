// (auth) Route Group: 未認証ユーザー向け（AppShell を適用しない）
// ログインページは自前で full-screen レイアウトを持つため、ここはパススルー。
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
