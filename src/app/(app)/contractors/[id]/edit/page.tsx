import Link from "next/link"
import { notFound } from "next/navigation"
import { ContractorForm } from "../../_components/contractor-form"
import { getContractor } from "@/lib/actions/contractors"
import { listAssignableUsers } from "@/lib/actions/clients"
import type { ContractorInput } from "@/lib/validators/contractor"

export const dynamic = "force-dynamic"

// Prisma Decimal → number | null 変換
function decimalToNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const num = typeof v === "number" ? v : Number(v.toString())
  return isNaN(num) ? null : num
}

export default async function EditContractorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [contractor, assignableUsers] = await Promise.all([
    getContractor(id),
    listAssignableUsers(),
  ])
  if (!contractor) notFound()
  const primary = contractor.contacts.find((c) => c.isPrimary)
  const defaultValues: ContractorInput = {
    contractorCode: contractor.contractorCode,
    contractorName: contractor.contractorName,
    contractorNameEn: contractor.contractorNameEn ?? "",
    isIndividual: contractor.isIndividual,
    specialties: contractor.specialties,
    contractType: contractor.contractType,
    packageFee: decimalToNumber(contractor.packageFee),
    hourlyRate: decimalToNumber(contractor.hourlyRate),
    monthlyFee: decimalToNumber(contractor.monthlyFee),
    country: contractor.country,
    postalCode: contractor.postalCode ?? "",
    prefecture: contractor.prefecture ?? "",
    city: contractor.city ?? "",
    address: contractor.address ?? "",
    addressLine2: contractor.addressLine2 ?? "",
    addressEn: contractor.addressEn ?? "",
    phone: contractor.phone ?? "",
    fax: contractor.fax ?? "",
    email: contractor.email ?? "",
    chatTool: contractor.chatTool ?? "",
    chatToolId: contractor.chatToolId ?? "",
    preferredLanguage: contractor.preferredLanguage,
    preferredCurrency: contractor.preferredCurrency,
    timezone: contractor.timezone ?? "",
    taxId: contractor.taxId ?? "",
    isQualifiedInvoiceIssuer: contractor.isQualifiedInvoiceIssuer,
    paymentTermType: contractor.paymentTermType,
    closingDay: contractor.closingDay ?? null,
    paymentMonthOffset: contractor.paymentMonthOffset ?? null,
    paymentDay: contractor.paymentDay ?? null,
    assignedToUserId: contractor.assignedToUserId ?? "",
    primaryContact: {
      firstName: primary?.firstName ?? "",
      lastName: primary?.lastName ?? "",
      jobTitle: primary?.jobTitle ?? "",
      department: primary?.department ?? "",
      email: primary?.email ?? "",
      phone: primary?.phone ?? "",
      mobile: primary?.mobile ?? "",
    },
    status: contractor.status,
    notes: contractor.notes ?? "",
  }
  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/contractors/${id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          &lt; 詳細へ
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{contractor.contractorName}を編集</h1>
        <p className="text-sm text-muted-foreground mt-1">
          外注先情報を編集できます。
        </p>
      </div>
      <ContractorForm
        mode="edit"
        id={id}
        assignableUsers={assignableUsers}
        defaultValues={defaultValues}
      />
    </div>
  )
}
