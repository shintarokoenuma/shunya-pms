import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getMaterial,
  listActiveSuppliersForMaterialSelect,
} from "@/lib/actions/materials"
import { listAllActiveMaterialCategoriesForSelect } from "@/lib/actions/material-categories"
import { MaterialForm } from "../../_components/material-form"
import type { MaterialBaseInput } from "@/lib/validators/material"

type Params = Promise<{ id: string }>

function decimalToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return String(value)
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof (value as { toString: () => string }).toString === "function"
  ) {
    return (value as { toString: () => string }).toString()
  }
  return String(value)
}

export default async function EditMaterialPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params

  // ARCHIVED カテゴリを参照している Material も「現在値」を Select に残すため、
  // getMaterial を先に解決してから includeIds 付きで categories を取得する。
  const result = await getMaterial(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const [suppliers, categories] = await Promise.all([
    listActiveSuppliersForMaterialSelect(),
    listAllActiveMaterialCategoriesForSelect(
      item.categoryId ? { includeIds: [item.categoryId] } : undefined,
    ),
  ])

  const defaultValues: MaterialBaseInput = {
    materialCode: item.materialCode,
    materialName: item.materialName,
    materialNameEn: item.materialNameEn ?? "",
    materialType: item.materialType,
    categoryId: item.categoryId,
    primarySupplierId: item.primarySupplierId ?? "",
    unitPrice: decimalToString(item.unitPrice) || null,
    currency: item.currency,
    unit: item.unit,
    minimumOrderQty: decimalToString(item.minimumOrderQty) || null,
    // Phase 1A-13b
    fabricWeight: decimalToString(item.fabricWeight) || null,
    fabricWidth: decimalToString(item.fabricWidth) || null,
    composition: item.composition ?? "",
    swatchImageUrl: item.swatchImageUrl,
    standardUsage: decimalToString(item.standardUsage) || null,
    standardLossRate: decimalToString(item.standardLossRate) || null,
    hsCode: item.hsCode ?? "",
    originCountry: item.originCountry ?? "",
    imageUrl: item.imageUrl,
    specification: item.specification ?? "",
    notes: item.notes ?? "",
    status: item.status,
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/materials/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">素材 編集</h1>
        <p className="text-sm text-muted-foreground">
          {item.materialName}（{item.materialCode}）
        </p>
      </div>
      <MaterialForm
        mode="edit"
        id={id}
        suppliers={suppliers}
        categories={categories}
        defaultValues={defaultValues}
      />
    </div>
  )
}
