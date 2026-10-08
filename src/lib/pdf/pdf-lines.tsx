import { Text, View } from "@react-pdf/renderer"
import { NO_BREAK_CALLBACK } from "./sewing-spec-layout"

type Style = object | object[]
const asArray = (s?: Style): object[] => (s === undefined ? [] : Array.isArray(s) ? s : [s])

/**
 * B-268: 先に決めた行を1行ずつ Text で描く（行を "\n" でつながない）。
 * ★"\n" でつなぐと、改行の字（U+000A）が NotoSansJP に無いため react-pdf が予備の Helvetica（埋め込みなし）の空の run を出す（dev 実測:
 *   INV-2026-0004 で /Helvetica が1つ増えた）。1行ずつ別の Text にすれば改行の字が無く、フォントは Regular・Bold の2つのまま。
 * - 1行なら今までどおり1つの Text（style をそのまま付ける）
 * - 2行以上なら style（列の幅・余白）を View に、textStyle（文字の大きさ・色）を各行の Text に付ける
 * - どの行も幅に入るように決めてあるので、Text には NO_BREAK_CALLBACK を付けて react-pdf には折らせない
 */
export function Lines({ lines, style, textStyle }: { lines: string[]; style?: Style; textStyle?: Style }) {
  if (lines.length <= 1) {
    return (
      <Text style={[...asArray(style), ...asArray(textStyle)] as never} hyphenationCallback={NO_BREAK_CALLBACK}>
        {lines[0] ?? ""}
      </Text>
    )
  }
  return (
    <View style={asArray(style) as never}>
      {lines.map((l, i) => (
        <Text key={i} style={asArray(textStyle) as never} hyphenationCallback={NO_BREAK_CALLBACK}>
          {l}
        </Text>
      ))}
    </View>
  )
}
