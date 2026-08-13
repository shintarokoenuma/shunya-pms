import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listSalesOrders } from "@/lib/actions/sales-orders"
import { SalesOrdersTable } from "./_components/sales-orders-table"

export default async function SalesOrdersPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const result = await listSalesOrders()
  if (!result.ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">受注</h1>
          <p className="text-sm text-muted-foreground">
            クライアントからの発注1通＝1受注（複数品番可）。SKU 別の受注数を記録します。
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/sales-orders/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>
      <SalesOrdersTable rows={result.data.rows} />
    </div>
  )
}
