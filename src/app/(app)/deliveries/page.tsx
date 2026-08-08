import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listDeliveryNotes } from "@/lib/actions/delivery-notes"
import { DeliveryNotesSearch } from "./_components/delivery-notes-search"
import { DeliveryNotesTable } from "./_components/delivery-notes-table"
import { DeliveryNotesPagination } from "./_components/delivery-notes-pagination"
import type { DeliveryNoteStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  page?: string
}>

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const result = await listDeliveryNotes({
    q: sp.q ?? "",
    status: sp.status as DeliveryNoteStatus | undefined,
    page,
    pageSize: 20,
  })

  if (!result.ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    )
  }
  const { items, total, totalPages, page: currentPage } = result.data

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">納品書</h1>
          <p className="text-sm text-muted-foreground">
            サンプル・見本類の納品書（DLV）。複数品番・見本類を1枚に混在できます。
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/deliveries/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>
      <DeliveryNotesSearch />
      <DeliveryNotesTable items={items} />
      <DeliveryNotesPagination page={currentPage} totalPages={totalPages} total={total} />
    </div>
  )
}
