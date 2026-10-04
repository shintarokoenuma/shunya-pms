/**
 * B-244（D-5）: パスワードを変えたら、ほかの端末のログインも切るための判定（純関数・DB 非接続）。
 * - passwordChangedAt が null（一度も変えていない）なら切らない
 * - passwordChangedAt が loginAt（その端末でログインした時刻・ms）より後なら切る（＝jwt を null にする）
 * - loginAt が無い token（このデプロイ前からログインしている人）は、呼ぶ側がその場の時刻を入れてから渡す（締め出さない）
 */
export function isSessionStale(passwordChangedAt: Date | null | undefined, loginAt: number): boolean {
  if (!passwordChangedAt) return false
  return passwordChangedAt.getTime() > loginAt
}
