import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listActiveClientsForBuyerSelect } from "@/lib/actions/buyers"
import { BuyerForm } from "../_components/buyer-form"

type SearchParams = Promise<{ clientId?: string }>

export default async function NewBuyerPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const clients = await listActiveClientsForBuyerSelect()

  // クエリで clientId が指定されていれば、フォーム初期値に反映
  // （Client 詳細ページの「バイヤーを追加」ボタンから遷移した場合）
  const initialClientId =
    sp.clientId && clients.some((c) => c.id === sp.clientId)
      ? sp.clientId
      : null

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/buyers">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          バイヤー 新規作成
        </h1>
      </div>
      <BuyerForm
        mode="create"
        clients={clients}
        defaultValues={initialClientId ? { clientId: initialClientId } : undefined}
      />
    </div>
  )
}
