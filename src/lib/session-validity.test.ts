/**
 * B-244（§3-5）: isSessionStale と、プロフィールの validator の検証（テストランナー非依存・DB 非接続）。
 * 手動実行: `npx tsx src/lib/session-validity.test.ts`
 */

import { isSessionStale } from "./session-validity"
import { changeMyPasswordSchema, updateMyProfileSchema } from "./validators/user-management"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① isSessionStale（D-5）
{
  const loginAt = Date.UTC(2026, 9, 5, 0, 0, 0)
  assert(!isSessionStale(null, loginAt), "①-1 passwordChangedAt が null → 切らない")
  assert(!isSessionStale(undefined, loginAt), "①-1' undefined → 切らない")
  assert(!isSessionStale(new Date(loginAt - 1000), loginAt), "①-2 passwordChangedAt < loginAt → 切らない")
  assert(!isSessionStale(new Date(loginAt), loginAt), "①-2' 同時刻 → 切らない")
  assert(isSessionStale(new Date(loginAt + 1000), loginAt), "①-3 passwordChangedAt > loginAt → 切る")
}

// ② updateMyProfileSchema（D-2）
{
  assert(!updateMyProfileSchema.safeParse({ lastName: "", firstName: "太郎", displayName: "" }).success, "②-1 姓が空は NG")
  assert(!updateMyProfileSchema.safeParse({ lastName: "確認用", firstName: "  ", displayName: "" }).success, "②-1' 名が空白だけは NG")
  const ok = updateMyProfileSchema.safeParse({ lastName: " 確認用 ", firstName: "太郎", displayName: "" })
  assert(ok.success && ok.data.lastName === "確認用" && ok.data.displayName === null, "②-2 trim され、表示名の空文字は null")
  const ok2 = updateMyProfileSchema.safeParse({ lastName: "確認用", firstName: "太郎", displayName: "  スタッフ太郎 " })
  assert(ok2.success && ok2.data.displayName === "スタッフ太郎", "②-2' 表示名は trim される")
  assert(!updateMyProfileSchema.safeParse({ lastName: "あ".repeat(101), firstName: "太郎", displayName: "" }).success, "②-3 姓 101 文字は NG")
  assert(updateMyProfileSchema.safeParse({ lastName: "あ".repeat(100), firstName: "太郎", displayName: "" }).success, "②-3' 姓 100 文字は OK")
  assert(!updateMyProfileSchema.safeParse({ lastName: "確認用", firstName: "太郎", displayName: "あ".repeat(201) }).success, "②-3'' 表示名 201 文字は NG")
}

// ③ changeMyPasswordSchema（D-4）
{
  assert(!changeMyPasswordSchema.safeParse({ currentPassword: "old", password: "1234567", passwordConfirm: "1234567" }).success, "③-1 7 文字は NG")
  const mismatch = changeMyPasswordSchema.safeParse({ currentPassword: "old", password: "12345678", passwordConfirm: "12345679" })
  assert(!mismatch.success && mismatch.error.issues[0]?.path[0] === "passwordConfirm", "③-2 確認の不一致は NG（path は passwordConfirm）")
  assert(!changeMyPasswordSchema.safeParse({ currentPassword: "", password: "12345678", passwordConfirm: "12345678" }).success, "③-3 今のパスワードが空は NG")
  assert(changeMyPasswordSchema.safeParse({ currentPassword: "old", password: "12345678", passwordConfirm: "12345678" }).success, "③-4 8 文字・一致は OK")
}

console.log("session-validity.test.ts: all assertions passed")
