import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listActiveSuppliersForMaterialSelect } from "@/lib/actions/materials"
import { MaterialForm } from "../_components/material-form"

type SearchParams = Promise<{ primarySupplierId?: string }>

export default async function NewMaterialPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const suppliers = await listActiveSuppliersForMaterialSelect()

  const initialSupplierId =
    sp.primarySupplierId && suppliers.some((s) => s.id === sp.primarySupplierId)
      ? sp.primarySupplierId
      : undefined

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/materials">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">素材 新規作成</h1>
      </div>
      <MaterialForm
        mode="create"
        suppliers={suppliers}
        defaultValues={
          initialSupplierId
            ? { primarySupplierId: initialSupplierId }
            : undefined
        }
      />
    </div>
  )
}
