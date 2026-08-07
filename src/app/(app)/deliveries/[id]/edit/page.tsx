import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getDeliveryNote,
  listActiveClientsForDeliverySelect,
  listActiveBuyersForDeliverySelect,
  listActiveDestinationsForDeliverySelect,
  listActiveProductsForDeliverySelect,
} from "@/lib/actions/delivery-notes"
import { DeliveryNoteForm } from "../../_components/delivery-note-form"
import type { DeliveryNoteFormInitial } from "../../_components/delivery-note-form"

type Params = Promise<{ id: string }>

function toDateInput(value: Date | null): string {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}
function toStr(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object" && "toNumber" in value)
    return String((value as { toNumber: () => number }).toNumber())
  return String(value)
}

export default async function EditDeliveryNotePage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, clients, buyers, destinations, products] = await Promise.all([
    getDeliveryNote(id),
    listActiveClientsForDeliverySelect(),
    listActiveBuyersForDeliverySelect(),
    listActiveDestinationsForDeliverySelect(),
    listActiveProductsForDeliverySelect(),
  ])
  if (!result.ok) notFound()
  const dn = result.data

  // §9 / §4-3 と同型: DRAFT のみ編集可。非 DRAFT は詳細へ redirect（直 URL 到達を塞ぐ）。
  if (dn.status !== "DRAFT") {
    redirect(`/deliveries/${id}`)
  }

  // 消費税率はヘッダに列が無い（金額は税込/税抜の確定値のみ保持）。v1 は 10% 固定なので
  // 編集初期値も 10 を既定にする（作成時と同じ扱い・手入力上書き可）。
  const initial: DeliveryNoteFormInitial = {
    clientId: dn.clientId,
    buyerId: dn.buyerId,
    deliveryDestinationId: dn.deliveryDestinationId,
    deliveryDate: toDateInput(dn.deliveryDate),
    showAmounts: dn.showAmounts,
    taxRatePercent: "10",
    shipToAddress: dn.shipToAddress ?? "",
    shipToContact: dn.shipToContact ?? "",
    shipToPhone: dn.shipToPhone ?? "",
    clientNotes: dn.clientNotes ?? "",
    items: dn.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      clientProductCode: it.clientProductCode ?? "",
      colorName: it.colorName ?? "",
      size: it.size ?? "",
      quantity: String(it.quantity),
      unit: it.unit,
      unitPrice: it.unitPrice == null ? "" : toStr(it.unitPrice),
    })),
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/deliveries/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">納品書 編集</h1>
        <p className="font-mono text-sm text-muted-foreground">
          {dn.deliveryNumber}
        </p>
      </div>
      <DeliveryNoteForm
        mode="edit"
        id={id}
        clients={clients}
        buyers={buyers}
        destinations={destinations}
        products={products}
        initial={initial}
        currentDeliveryNumber={dn.deliveryNumber}
      />
    </div>
  )
}
