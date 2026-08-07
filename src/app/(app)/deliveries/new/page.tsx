import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listActiveClientsForDeliverySelect,
  listActiveBuyersForDeliverySelect,
  listActiveDestinationsForDeliverySelect,
  listActiveProductsForDeliverySelect,
  generateNextDeliveryNumberPreview,
} from "@/lib/actions/delivery-notes"
import { DeliveryNoteForm } from "../_components/delivery-note-form"

export default async function NewDeliveryNotePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [clients, buyers, destinations, products, preview] = await Promise.all([
    listActiveClientsForDeliverySelect(),
    listActiveBuyersForDeliverySelect(),
    listActiveDestinationsForDeliverySelect(),
    listActiveProductsForDeliverySelect(),
    generateNextDeliveryNumberPreview(),
  ])

  const previewNumber = preview.ok ? preview.data.preview : null
  const defaultDate = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/deliveries">
            <ChevronLeft className="mr-1 h-4 w-4" />
            納品書一覧へ
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">納品書 新規作成</h1>
        <p className="text-sm text-muted-foreground">
          手入力で明細を作成します（サンプル・WO/PO からの引き当ては後続）。
        </p>
      </div>
      <DeliveryNoteForm
        clients={clients}
        buyers={buyers}
        destinations={destinations}
        products={products}
        previewNumber={previewNumber}
        defaultDate={defaultDate}
      />
    </div>
  )
}
