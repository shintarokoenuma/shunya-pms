import Link from "next/link"
import { notFound } from "next/navigation"
import { ClientForm } from "../../_components/client-form"
import { getClient, listAssignableUsers } from "@/lib/actions/clients"
import type { ClientBaseInput } from "@/lib/validators/client"

export const dynamic = "force-dynamic"

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [client, assignableUsers] = await Promise.all([
    getClient(id),
    listAssignableUsers(),
  ])
  if (!client) notFound()

  const contact = client.contacts[0]
  const useSeparateBilling =
    !!client.billingPostalCode ||
    !!client.billingPrefecture ||
    !!client.billingCity ||
    !!client.billingAddress ||
    !!client.billingAddressLine2
  const useSeparateShipping =
    !!client.shippingPostalCode ||
    !!client.shippingPrefecture ||
    !!client.shippingCity ||
    !!client.shippingAddress ||
    !!client.shippingAddressLine2

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
    postalCode: client.postalCode ?? "",
    prefecture: client.prefecture ?? "",
    city: client.city ?? "",
    address: client.address ?? "",
    addressLine2: client.addressLine2 ?? "",
    useSeparateBillingAddress: useSeparateBilling,
    billingPostalCode: client.billingPostalCode ?? "",
    billingPrefecture: client.billingPrefecture ?? "",
    billingCity: client.billingCity ?? "",
    billingAddress: client.billingAddress ?? "",
    billingAddressLine2: client.billingAddressLine2 ?? "",
    useSeparateShippingAddress: useSeparateShipping,
    shippingPostalCode: client.shippingPostalCode ?? "",
    shippingPrefecture: client.shippingPrefecture ?? "",
    shippingCity: client.shippingCity ?? "",
    shippingAddress: client.shippingAddress ?? "",
    shippingAddressLine2: client.shippingAddressLine2 ?? "",
    displayPattern: client.displayPattern,
    leadSource: client.leadSource ?? undefined,
    referrer: client.referrer ?? "",
    paymentTermType: client.paymentTermType,
    closingDay: client.closingDay ?? undefined,
    paymentMonthOffset: client.paymentMonthOffset ?? undefined,
    paymentDay: client.paymentDay ?? undefined,
    depositRequired: client.depositRequired,
    depositPercentage: client.depositPercentage
      ? Number(client.depositPercentage)
      : undefined,
    assignedToUserId: client.assignedToUserId ?? "",
    primaryContact: {
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      jobTitle: contact?.jobTitle ?? "",
      department: contact?.department ?? "",
    },
    status: client.status,
    notes: client.notes ?? "",
  }

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/clients/${id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          &lt; 詳細へ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{client.companyName}を編集</h1>
        <p className="text-sm text-muted-foreground mt-1">
          基本情報を編集できます。
        </p>
      </div>

      <ClientForm
        mode="edit"
        id={id}
        assignableUsers={assignableUsers}
        defaultValues={defaultValues}
      />
    </div>
  )
}
