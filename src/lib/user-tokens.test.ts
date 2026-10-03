/**
 * B-205 PR-3（P3-D4）: トークンの生成とハッシュの純関数の検証（テストランナー非依存・DB 非接続）。
 * 手動実行: `npx tsx src/lib/user-tokens.test.ts`
 */

import { generateToken, hashToken } from "./user-tokens"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① 生成: base64url（URL に入れられる文字だけ）・32 バイト＝43 文字・毎回違う
{
  const a = generateToken()
  const b = generateToken()
  assert(/^[A-Za-z0-9_-]+$/.test(a), "① base64url の文字だけ")
  assert(a.length === 43, `①' 32 バイトは 43 文字（実測 ${a.length}）`)
  assert(a !== b, "①'' 毎回違う")
}

// ② ハッシュ: SHA-256 の16進 64 文字・決定的・既知の値・生の値と一致しない
{
  const h = hashToken("abc")
  assert(h === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "② SHA-256(\"abc\")")
  assert(h.length === 64 && /^[0-9a-f]{64}$/.test(h), "②' 64 文字の16進")
  assert(hashToken("abc") === h, "②'' 決定的")
  const raw = generateToken()
  assert(hashToken(raw) !== raw && hashToken(raw).length === 64, "②''' 生の値と一致しない")
}

console.log("user-tokens.test.ts: all assertions passed")
