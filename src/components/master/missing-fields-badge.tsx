/**
 * B-252（D-7）: 一覧の名前の横に出す「未入力 N」。項目名は title 属性で見せる。0 件なら何も出さない。
 */
export function MissingFieldsBadge({ fields }: { fields: string[] }) {
  if (fields.length === 0) return null
  return (
    <span
      title={`未入力: ${fields.join("・")}`}
      className="ml-2 inline-block rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 align-middle text-[10px] font-normal text-amber-800"
    >
      未入力 {fields.length}
    </span>
  )
}
