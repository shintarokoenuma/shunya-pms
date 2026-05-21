import Link from "next/link"
import { notFound } from "next/navigation"
import { FactoryForm } from "../../_components/factory-form"
import { getFactory } from "@/lib/actions/factories"
import { listAssignableUsers } from "@/lib/actions/clients"
import type { FactoryInput } from "@/lib/validators/factory"

export const dynamic = "force-dynamic"

export default async function EditFactoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [factory, assignableUsers] = await Promise.all([
    getFactory(id),
    listAssignableUsers(),
  ])
  if (!factory) notFound()
  const primary = factory.contacts.find((c) => c.isPrimary)
  const defaultValues: FactoryInput = {
    factoryCode: factory.factoryCode,
    factoryName: factory.factoryName,
    factoryNameEn: factory.factoryNameEn ?? "",
    factoryTypes: factory.factoryTypes,
    contractTypes: factory.contractTypes,
    country: factory.country,
    postalCode: factory.postalCode ?? "",
    prefecture: factory.prefecture ?? "",
    city: factory.city ?? "",
    address: factory.address ?? "",
    addressLine2: factory.addressLine2 ?? "",
    addressEn: factory.addressEn ?? "",
    phone: factory.phone ?? "",
    fax: factory.fax ?? "",
    email: factory.email ?? "",
    chatTool: factory.chatTool ?? "",
    chatToolId: factory.chatToolId ?? "",
    preferredLanguage: factory.preferredLanguage,
    preferredCurrency: factory.preferredCurrency,
    timezone: factory.timezone ?? "",
    taxId: factory.taxId ?? "",
    isQualifiedInvoiceIssuer: factory.isQualifiedInvoiceIssuer,
    paymentTermType: factory.paymentTermType,
    closingDay: factory.closingDay ?? null,
    paymentMonthOffset: factory.paymentMonthOffset ?? null,
    paymentDay: factory.paymentDay ?? null,
    monthlyCapacity: factory.monthlyCapacity ?? null,
    minimumOrderQty: factory.minimumOrderQty ?? null,
    averageLeadTimeDays: factory.averageLeadTimeDays ?? null,
    assignedToUserId: factory.assignedToUserId ?? "",
    primaryContact: {
      firstName: primary?.firstName ?? "",
      lastName: primary?.lastName ?? "",
      jobTitle: primary?.jobTitle ?? "",
      department: primary?.department ?? "",
      email: primary?.email ?? "",
      phone: primary?.phone ?? "",
      mobile: primary?.mobile ?? "",
    },
    status: factory.status,
    notes: factory.notes ?? "",
  }
  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/factories/${id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          &lt; 詳細へ
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{factory.factoryName}を編集</h1>
        <p className="text-sm text-muted-foreground mt-1">
          工場情報を編集できます。
        </p>
      </div>
      <FactoryForm
        mode="edit"
        id={id}
        assignableUsers={assignableUsers}
        defaultValues={defaultValues}
      />
    </div>
  )
}
