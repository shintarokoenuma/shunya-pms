/**
 * 色チップ表示コンポーネント。
 *
 * - colorNumber === "00" のときは「カラー未定」を表すプレースホルダ
 *   （斜線パターン）で hex が空でも崩れない
 * - それ以外は hex の背景色で塗りつぶす。hex が空・不正でも安全に
 *   フォールバックする（透明 + 枠線）
 */
export function ColorSwatch({
  colorNumber,
  hex,
  size = "md",
}: {
  colorNumber: string
  hex: string | null | undefined
  size?: "sm" | "md" | "lg"
}) {
  const sizeClass =
    size === "sm" ? "h-6 w-6" : size === "lg" ? "h-12 w-12" : "h-8 w-8"

  if (colorNumber === "00") {
    return (
      <div
        aria-label="カラー未定（マルチ／プリント）"
        title="カラー未定（マルチ／プリント）"
        className={`${sizeClass} rounded-md border bg-[repeating-linear-gradient(45deg,_#e5e7eb_0_4px,_#f9fafb_4px_8px)]`}
      />
    )
  }

  const isValidHex = typeof hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(hex)
  return (
    <div
      aria-label={isValidHex ? hex! : "色値不明"}
      title={isValidHex ? hex! : "色値不明"}
      className={`${sizeClass} rounded-md border`}
      style={
        isValidHex
          ? { backgroundColor: hex! }
          : { background: "transparent" }
      }
    />
  )
}
