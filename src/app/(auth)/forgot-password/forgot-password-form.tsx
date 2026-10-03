"use client"

import { useState } from "react"
import { requestPasswordReset } from "@/lib/actions/password-reset"
import { authButtonClass, authInputClass } from "../_components/auth-card"

/**
 * B-205 PR-3（§4-6・P3-D6）: メールアドレス1欄。送ったら（登録の有無に関係なく）同じ文を出す
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    const r = await requestPasswordReset({ email })
    setIsLoading(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setMessage(r.data.message)
  }

  if (message) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">登録しているメールアドレスを入力してください。再設定のリンクを送ります。</p>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className={authInputClass}
          placeholder="your@email.com"
          autoComplete="email"
        />
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      <button type="submit" disabled={isLoading} className={authButtonClass}>
        {isLoading ? "送信中..." : "再設定のメールを送る"}
      </button>
    </form>
  )
}
