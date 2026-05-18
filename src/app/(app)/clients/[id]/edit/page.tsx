import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/actions/clients"
import { ClientForm } from "../../_components/client-form"
import type { ClientBaseInput } from "@/lib/validators/client"

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClient(id)

  if (!client) {
    notFound()
  }

  // DB の Client を ClientBaseInput 形式に変換（null → "" / undefined）
  const defaultValues: ClientBaseInput = {
    clientCode: client.clientCode,
    companyName: client.companyName,
    legalEntity: client.legalEntity ?? "",
    businessType: client.businessType,
    clientSize: client.clientSize ?? undefined,
    country: client.country,
    phone: client.phone ?? "",
    email: client.email ?? "",
    website: client.website ?? "",
    address: client.address ?? "",
    displayPattern: client.displayPattern,
    leadSource: client.leadSource ?? undefined,
    referrer: client.referrer ?? "",
    status: client.status,
    notes: client.notes ?? "",
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link href={`/clients/${client.id}`}>
            <ChevronLeft className="size-4" />
            詳細へ戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          クライアント編集
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {client.companyName}（{client.clientCode}）
        </p>
      </div>

      <ClientForm
        mode="edit"
        clientId={client.id}
        defaultValues={defaultValues}
      />
    </div>
  )
}
