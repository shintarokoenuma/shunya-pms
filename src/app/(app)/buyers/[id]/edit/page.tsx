import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getBuyer,
  listActiveClientsForBuyerSelect,
} from "@/lib/actions/buyers"
import { BuyerForm } from "../../_components/buyer-form"
import type { BuyerBaseInput } from "@/lib/validators/buyer"

type Params = Promise<{ id: string }>

export default async function EditBuyerPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, clients] = await Promise.all([
    getBuyer(id),
    listActiveClientsForBuyerSelect(),
  ])
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const defaultValues: BuyerBaseInput = {
    buyerCode: item.buyerCode,
    buyerName: item.buyerName,
    buyerNameEn: item.buyerNameEn ?? "",
    clientId: item.clientId,
    country: item.country,
    postalCode: item.postalCode ?? "",
    prefecture: item.prefecture ?? "",
    city: item.city ?? "",
    address: item.address ?? "",
    addressLine2: item.addressLine2 ?? "",
    contactPerson: item.contactPerson ?? "",
    phone: item.phone ?? "",
    email: item.email ?? "",
    notes: item.notes ?? "",
    status: item.status,
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/buyers/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          バイヤー 編集
        </h1>
        <p className="text-sm text-muted-foreground">
          {item.buyerName}（{item.buyerCode}）
        </p>
      </div>
      <BuyerForm
        mode="edit"
        id={id}
        clients={clients}
        defaultValues={defaultValues}
      />
    </div>
  )
}
