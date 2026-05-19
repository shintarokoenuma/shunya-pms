import Link from "next/link"
import { BrandForm } from "../_components/brand-form"
import { listClientsForBrand } from "@/lib/actions/brands"

export const dynamic = "force-dynamic"

export default async function NewBrandPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const sp = await searchParams
  const clientOptions = await listClientsForBrand()

  const defaultValues = sp.clientId ? { clientId: sp.clientId } : undefined

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/brands" className="text-muted-foreground hover:text-foreground">
          &lt; ブランド一覧へ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">ブランド新規登録</h1>
        <p className="text-sm text-muted-foreground mt-1">
          クライアントに紐付けてブランドを登録します。
        </p>
      </div>

      <BrandForm
        mode="create"
        clientOptions={clientOptions}
        defaultValues={defaultValues}
      />
    </div>
  )
}
