import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { SupplierInvoiceImport } from "../_components/supplier-invoice-import"

/** B-212 PR-1（P1-D7）: CSV の取り込み。①ファイルを選ぶ →「読み取る」 ②確認画面 ③「保存する」 */
export default async function SupplierInvoiceImportPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/supplier-invoices"><ChevronLeft className="mr-1 h-4 w-4" />一覧に戻る</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">仕入請求書の CSV を取り込む</h1>
        <p className="text-sm text-muted-foreground">
          B-070 の月次 CSV（明細1行＝1行・UTF-8）を読み取り、相手先と品番の当て方を確かめてから保存します。
          自動で当たった行はそのまま、覚えた対応で当てた行は「確認済み」にしてから、未一致の行は品番を選んでから保存します（未一致のまま保存もできます）。
        </p>
      </div>
      <SupplierInvoiceImport />
    </div>
  )
}
