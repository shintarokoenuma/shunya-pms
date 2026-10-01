import Link from "next/link"

/**
 * B-252（D-7）: 詳細のヘッダの下に出す「未入力: 電話・メール・…」と編集画面へのリンク。0 件なら何も出さない。
 */
export function MissingFieldsNotice({ fields, editHref }: { fields: string[]; editHref: string }) {
  if (fields.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span>未入力: {fields.join("・")}</span>
      <Link href={editHref} className="underline hover:no-underline">
        編集して入力する
      </Link>
    </div>
  )
}
