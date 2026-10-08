/**
 * B-266 D-2（B-249 の最小）: デザイン番号（PoItem.designCode・先方 D/#）の表示用の整形（prisma 非依存）。
 * - 前後の空白を取る。空なら null
 * - 頭がすでに D/# か D#（大文字小文字・間の空白を問わない）で始まっていればそのまま出す
 * - それ以外は頭に "D/# " を付ける
 * 保存の仕組み・保存済みの値は変えない（頭の付け方の本決めは B-249 に残す）
 */
const DESIGN_PREFIX_RE = /^d\s*\/?\s*#/i

export function formatDesignCode(v: string | null | undefined): string | null {
  const t = (v ?? "").trim()
  if (t === "") return null
  return DESIGN_PREFIX_RE.test(t) ? t : `D/# ${t}`
}
