/**
 * B-248: 色番（colorCode・先方 C/#）の正規化と表示の共通関数（prisma 非依存）。
 * - 保存: normalizeSupplierColorCode で頭の C/# を取る（B-062 の BomItemColorway と同じ規則）
 * - 表示: formatColorCode で数字で始まるときだけ "C/#" を付ける（カーキ などの色名はそのまま）
 */

/**
 * 先方カラー品番の "C/#" 接頭辞を剥がして番号だけにする正規化。
 * "c/#099" "C/#099" "Ｃ／＃099" "#099" "# 099" "C/099" → "099"。
 * - 全角 Ｃ／＃ を半角化したのち、先頭の C/# マーカー（/ か # を必ず含む）と前後空白を除去。
 * - マーカーを含まない場合（"C99" など英字混じり番号）は中身を触らない＝接頭辞だけ除去。
 * - 冪等: 既に正規化済み（"099"）に再適用しても同じ結果。サーバ側を最終防衛線とする。
 */
export function normalizeSupplierColorCode(raw: string): string {
  const halfWidth = raw
    .replace(/Ｃ/g, "C")
    .replace(/ｃ/g, "c")
    .replace(/／/g, "/")
    .replace(/＃/g, "#")
    .trim()
  // 先頭: 任意の C → 任意空白 → ( "/" + 任意"#" | "#" ) → 任意空白 を除去（/ か # が必須）
  return halfWidth.replace(/^[cC]?\s*(?:\/\s*#?|#)\s*/, "").trim()
}

/**
 * B-248: 表示用。trim して空なら null。先頭が半角数字なら "C/#" + 値、それ以外（"カーキ"・旧データの "c/#12" など）は値をそのまま返す。
 */
export function formatColorCode(v: string | null | undefined): string | null {
  const t = (v ?? "").trim()
  if (t === "") return null
  return /^[0-9]/.test(t) ? `C/#${t}` : t
}
