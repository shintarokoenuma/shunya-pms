import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listExpenseCategories } from "@/lib/actions/expense-categories"
import { ExpenseCategoriesSearch } from "./_components/expense-categories-search"
import { ExpenseCategoriesTable } from "./_components/expense-categories-table"
import { ExpenseCategoriesPagination } from "./_components/expense-categories-pagination"
import type {
  ExpenseCategoryStatus,
  ExpenseType,
} from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  expenseType?: string
  page?: string
}>

export default async function ExpenseCategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const result = await listExpenseCategories({
    q: sp.q,
    status: sp.status as ExpenseCategoryStatus | undefined,
    expenseType: sp.expenseType as ExpenseType | undefined,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            諸経費カテゴリ
          </h1>
          <p className="text-sm text-muted-foreground">
            パターン代・検品費・輸送費など、見積もり原価明細で使う費用マスター
          </p>
        </div>
        <Button asChild>
          <Link href="/expense-categories/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <ExpenseCategoriesSearch />
      <ExpenseCategoriesTable items={items} />
      <ExpenseCategoriesPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
