import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listActiveClientsForDeliverySelect,
  listActiveProductsForDeliverySelect,
} from "@/lib/actions/delivery-notes"
import { SalesOrderForm } from "../_components/sales-order-form"

export default async function NewSalesOrderPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [clients, products] = await Promise.all([
    listActiveClientsForDeliverySelect(),
    listActiveProductsForDeliverySelect(),
  ])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/sales-orders">
            <ChevronLeft className="mr-1 h-4 w-4" />
            受注一覧
          </Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">受注を新規作成</h1>
      <SalesOrderForm
        mode="create"
        clients={clients}
        products={products.map((p) => ({
          id: p.id,
          productCode: p.productCode,
          productName: p.productName,
        }))}
      />
    </div>
  )
}
