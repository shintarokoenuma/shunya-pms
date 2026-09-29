/**
 * B-248: 色番（colorCode・先方 C/#）の正規化と表示の共通関数（prisma 非依存）。
 * - 保存: normalizeSupplierColorCode で頭の C/# を取る（B-062 の BomItemColorway と同じ規則）
 * - 表示: formatColorCode で正規化してから、番号（数字を含み日本語を含まない値）にだけ "C/#" を1回付ける（カーキ などの色名はそのまま）
 */

/**
 * 先方カラー品番の "C/#" 接頭辞を剥がして番号だけにする正規化。
 * "c/#099" "C/#099" "Ｃ／＃099" "#099" "# 099" "C/099" → "099"。
 * - 全角 Ｃ／＃ を半角化したのち、先頭の C/# マーカー（/ か # を必ず含む）と前後空白を除去。
 * - マーカーを含まない場合（"C99" など英字混じり番号）は中身を触らない＝接頭辞だけ除去。
 * - 冪等: 既に正規化済み（"099"）に再適用しても同じ結果。サーバ側を最終防衛線とする。
 * - B-248（慎太郎さん 2026-09-29）: 先頭で NFKC をかけ、全角の英数字も半角にそろえる（"C/＃８" → "8"・"ＢＫ０１" → "BK01"）。
 *   B-062 の BomItemColorway の C/# も同じ関数なので一緒に変わる。
 */
export function normalizeSupplierColorCode(raw: string): string {
  const halfWidth = raw
    .normalize("NFKC")
    .replace(/Ｃ/g, "C")
    .replace(/ｃ/g, "c")
    .replace(/／/g, "/")
    .replace(/＃/g, "#")
    .trim()
  // 先頭: 任意の C → 任意空白 → ( "/" + 任意"#" | "#" ) → 任意空白 を除去（/ か # が必須）
  return halfWidth.replace(/^[cC]?\s*(?:\/\s*#?|#)\s*/, "").trim()
}

/** ひらがな・カタカナ・漢字・半角カナ */
const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/

/**
 * B-248: 表示用。trim → normalizeSupplierColorCode → 空なら null。
 * 数字を1つ以上含み日本語を含まない値（"12"・"BK01"・"12A"）は "C/#" + 値、それ以外（"BLACK"・"カーキ"）は正規化後の値。
 * 旧データの "c/#12" も正規化してから付けるので "C/#12" と1回だけ出る。
 */
export function formatColorCode(v: string | null | undefined): string | null {
  const t = normalizeSupplierColorCode((v ?? "").trim())
  if (t === "") return null
  return /[0-9]/.test(t) && !JAPANESE_RE.test(t) ? `C/#${t}` : t
}
