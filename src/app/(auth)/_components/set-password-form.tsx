"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { acceptInvitation } from "@/lib/actions/invitations"
import { resetPassword } from "@/lib/actions/password-reset"
import { authButtonClass, authInputClass } from "./auth-card"

/**
 * B-205 PR-3（§4-5・§4-6）: パスワードと確認の2欄。招待の受諾（mode=invite）と再設定（mode=reset）で共用。
 * 成功したらログイン画面へ（?invited=1 / ?reset=1 で上に文を出す）
 */
export function SetPasswordForm({ token, mode }: { token: string; mode: "invite" | "reset" }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const submitLabel = mode === "invite" ? "パスワードを決めてはじめる" : "パスワードを変更する"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    const r =
      mode === "invite"
        ? await acceptInvitation({ token, password, passwordConfirm })
        : await resetPassword({ token, password, passwordConfirm })
    if (!r.ok) {
      setError(r.error)
      setIsLoading(false)
      return
    }
    router.push(mode === "invite" ? "/login?invited=1" : "/login?reset=1")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
          {mode === "invite" ? "パスワード" : "新しいパスワード"}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={isLoading}
          className={authInputClass}
          autoComplete="new-password"
        />
        <p className="text-xs text-slate-500 mt-1">8文字以上</p>
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="block text-sm font-medium text-slate-700 mb-1">
          パスワード（確認）
        </label>
        <input
          id="passwordConfirm"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          minLength={8}
          disabled={isLoading}
          className={authInputClass}
          autoComplete="new-password"
        />
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      <button type="submit" disabled={isLoading} className={authButtonClass}>
        {isLoading ? "保存中..." : submitLabel}
      </button>
    </form>
  )
}
