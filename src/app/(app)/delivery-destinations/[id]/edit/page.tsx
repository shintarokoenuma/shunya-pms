import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getDeliveryDestination,
  listActiveBuyersForDestinationSelect,
} from "@/lib/actions/delivery-destinations"
import { DeliveryDestinationForm } from "../../_components/delivery-destination-form"
import type { DeliveryDestinationBaseInput } from "@/lib/validators/delivery-destination"

type Params = Promise<{ id: string }>

export default async function EditDeliveryDestinationPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, buyers] = await Promise.all([
    getDeliveryDestination(id),
    listActiveBuyersForDestinationSelect(),
  ])
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const defaultValues: DeliveryDestinationBaseInput = {
    buyerId: item.buyerId,
    destinationCode: item.destinationCode,
    destinationName: item.destinationName,
    country: item.country,
    postalCode: item.postalCode ?? "",
    prefecture: item.prefecture ?? "",
    city: item.city ?? "",
    address: item.address ?? "",
    addressLine2: item.addressLine2 ?? "",
    contactPerson: item.contactPerson ?? "",
    phone: item.phone ?? "",
    email: item.email ?? "",
    deliveryNotes: item.deliveryNotes ?? "",
    preferredDeliveryDays: item.preferredDeliveryDays ?? "",
    preferredDeliveryHours: item.preferredDeliveryHours ?? "",
    timezone: item.timezone ?? "",
    notes: item.notes ?? "",
    status: item.status,
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/delivery-destinations/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">納品先 編集</h1>
        <p className="text-sm text-muted-foreground">
          {item.destinationName}（{item.destinationCode}）
        </p>
      </div>
      <DeliveryDestinationForm
        mode="edit"
        id={id}
        buyers={buyers}
        defaultValues={defaultValues}
      />
    </div>
  )
}
