import Link from "next/link"
import { notFound } from "next/navigation"
import { BrandForm } from "../../_components/brand-form"
import { getBrand, listClientsForBrand } from "@/lib/actions/brands"
import type { BrandBaseInput } from "@/lib/validators/brand"

export const dynamic = "force-dynamic"

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [brand, clientOptions] = await Promise.all([
    getBrand(id),
    listClientsForBrand(),
  ])
  if (!brand) notFound()

  const brandColors = brand.brandColors as { main?: string } | null

  const defaultValues: BrandBaseInput = {
    clientId: brand.clientId,
    brandCode: brand.brandCode,
    brandName: brand.brandName,
    brandNameEn: brand.brandNameEn ?? "",
    logoUrl: brand.logoUrl ?? "",
    mainColorHex: brandColors?.main ?? "",
    concept: brand.concept ?? "",
    defaultMarginRate: brand.defaultMarginRate
      ? Number(brand.defaultMarginRate)
      : undefined,
    status: brand.status,
  }

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/brands/${id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          &lt; 詳細へ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{brand.brandName}を編集</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ブランド情報を編集できます。
        </p>
      </div>

      <BrandForm
        mode="edit"
        id={id}
        clientOptions={clientOptions}
        defaultValues={defaultValues}
      />
    </div>
  )
}
