/**
 * B-063: 色まわりの共有型（中立モジュール・"use server"/prisma 非依存）。
 * client component が "use server" の actions ファイルから型を import すると
 * ブラウザバンドルに @prisma/client が引き込まれるため、型はここに置いて decouple する。
 */

/** カラーピッカー用の軽量 Color 表現（listActiveColorsForPicker の戻り）。 */
export type ColorPickerOption = {
  id: string
  colorNumber: string
  colorName: string
  colorNameEn: string | null
  hueGroup: number
  toneStep: number
  hex: string
}
