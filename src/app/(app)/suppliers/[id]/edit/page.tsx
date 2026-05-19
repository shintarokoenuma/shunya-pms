import Link from "next/link"
import { notFound } from "next/navigation"
import { SupplierForm } from "../../_components/supplier-form"
import { getSupplier } from "@/lib/actions/suppliers"
import { listAssignableUsers } from "@/lib/actions/clients"
import type { SupplierInput } from "@/lib/validators/supplier"

export const dynamic = "force-dynamic"

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supplier, assignableUsers] = await Promise.all([
    getSupplier(id),
    listAssignableUsers(),
  ])
  if (!supplier) notFound()

  const primary = supplier.contacts.find((c) => c.isPrimary)

  const defaultValues: SupplierInput = {
    supplierCode: supplier.supplierCode,
    companyName: supplier.companyName,
    companyNameEn: supplier.companyNameEn ?? "",
    supplierType: supplier.supplierType,
    country: supplier.country,
    postalCode: supplier.postalCode ?? "",
    prefecture: supplier.prefecture ?? "",
    city: supplier.city ?? "",
    address: supplier.address ?? "",
    addressLine2: supplier.addressLine2 ?? "",
    addressEn: supplier.addressEn ?? "",
    phone: supplier.phone ?? "",
    fax: supplier.fax ?? "",
    email: supplier.email ?? "",
    website: supplier.website ?? "",
    chatTool: supplier.chatTool ?? "",
    chatToolId: supplier.chatToolId ?? "",
    preferredLanguage: supplier.preferredLanguage,
    preferredCurrency: supplier.preferredCurrency,
    timezone: supplier.timezone ?? "",
    taxId: supplier.taxId ?? "",
    isQualifiedInvoiceIssuer: supplier.isQualifiedInvoiceIssuer,
    paymentTermType: supplier.paymentTermType,
    closingDay: supplier.closingDay ?? undefined,
    paymentMonthOffset: supplier.paymentMonthOffset ?? undefined,
    paymentDay: supplier.paymentDay ?? undefined,
    assignedToUserId: supplier.assignedToUserId ?? "",
    primaryContact: {
      firstName: primary?.firstName ?? "",
      lastName: primary?.lastName ?? "",
      jobTitle: primary?.jobTitle ?? "",
      department: primary?.department ?? "",
      email: primary?.email ?? "",
      phone: primary?.phone ?? "",
      mobile: primary?.mobile ?? "",
    },
    status: supplier.status,
    notes: supplier.notes ?? "",
  }

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/suppliers/${id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          &lt; 詳細へ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{supplier.companyName}を編集</h1>
        <p className="text-sm text-muted-foreground mt-1">
          仕入先情報を編集できます。
        </p>
      </div>

      <SupplierForm
        mode="edit"
        id={id}
        assignableUsers={assignableUsers}
        defaultValues={defaultValues}
      />
    </div>
  )
}
