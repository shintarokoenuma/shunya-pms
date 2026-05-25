import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getExpenseCategory } from "@/lib/actions/expense-categories"
import { ExpenseCategoryForm } from "../../_components/expense-category-form"

type Params = Promise<{ id: string }>

export default async function EditExpenseCategoryPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getExpenseCategory(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  // Decimal | null を number | null に変換（form 側の expected 型）
  const standardAmount =
    item.standardAmount === null
      ? null
      : typeof item.standardAmount === "object" && "toNumber" in item.standardAmount
        ? item.standardAmount.toNumber()
        : Number(item.standardAmount)

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/expense-categories/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          諸経費カテゴリ 編集
        </h1>
        <p className="text-sm text-muted-foreground">
          {item.expenseName}（{item.expenseCode}）
        </p>
      </div>
      <ExpenseCategoryForm
        mode="edit"
        initialId={id}
        initialValues={{
          expenseCode: item.expenseCode,
          expenseName: item.expenseName,
          expenseNameEn: item.expenseNameEn ?? "",
          expenseType: item.expenseType,
          standardAmount,
          currency: item.currency,
          calculationType: item.calculationType,
          notes: item.notes ?? "",
          status: item.status,
        }}
      />
    </div>
  )
}
