"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

/**
 * ログインのフォーム（B-205 PR-3 で page.tsx から切り出し。中身は PR-2 までと同じ）。
 * - B-205 PR-3（§4-6）: パスワード欄の下に「パスワードを忘れた方」。notice は page.tsx が ?invited / ?reset から組み立てる
 * - B-205 PR-3（慎太郎さんの要望）: パスワード欄の右端に表示／非表示の目のボタン（初期は隠す・保存しない）
 */
export function LoginForm({ notice }: { notice: string | null }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setShowPassword(false)
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // B-205 PR-2: 停止・アーカイブの人が正しいパスワードで来たときだけ code が account_suspended（auth.ts）
        setError(
          result.code === "account_suspended"
            ? "このアカウントは停止されています。管理者にお問い合わせください。"
            : "メールアドレスまたはパスワードが正しくありません",
        )
        setIsLoading(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      console.error("Login error:", err)
      setError("ログインに失敗しました。もう一度お試しください。")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">PMS</h1>
          <p className="text-slate-600 mt-2">生産管理システム</p>
        </div>

        {/* フォームカード */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            ログイン
          </h2>

          {notice && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-800">{notice}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition disabled:bg-slate-50 disabled:cursor-not-allowed"
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                パスワード
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-2 pr-11 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition disabled:bg-slate-50 disabled:cursor-not-allowed"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  aria-pressed={showPassword}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-900 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-right">
                <Link href="/forgot-password" className="text-xs text-slate-500 underline hover:text-slate-900">
                  パスワードを忘れた方
                </Link>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  ログイン中...
                </>
              ) : (
                "ログイン"
              )}
            </button>
          </form>

          {/* B-205 PR-2（2026-09-28）: 開発環境用テストアカウントの案内は本番では出さない（本番の画面に出ていたのを確認）／B-246（2026-09-30）: パスワードの値は出さない */}
          {process.env.NODE_ENV !== "production" && (
            <p className="text-xs text-slate-500 mt-6 text-center">
              開発環境用テストアカウント:<br />
              <code className="bg-slate-100 px-1.5 py-0.5 rounded">shin@shunya.jp</code> / パスワードは .env の <code className="bg-slate-100 px-1.5 py-0.5 rounded">SEED_OWNER_PASSWORD</code>
            </p>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          © 2026 shunya. All rights reserved.
        </p>
      </div>
    </div>
  )
}
