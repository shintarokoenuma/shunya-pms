import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listActiveBuyersForDestinationSelect } from "@/lib/actions/delivery-destinations"
import { DeliveryDestinationForm } from "../_components/delivery-destination-form"

type SearchParams = Promise<{ buyerId?: string }>

export default async function NewDeliveryDestinationPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const buyers = await listActiveBuyersForDestinationSelect()

  // クエリで buyerId が指定されていれば、フォーム初期値に反映
  //（Buyer 詳細ページの「納品先を追加」ボタンから遷移した場合）
  const initialBuyerId =
    sp.buyerId && buyers.some((b) => b.id === sp.buyerId)
      ? sp.buyerId
      : undefined

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/delivery-destinations">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          納品先 新規作成
        </h1>
      </div>
      <DeliveryDestinationForm
        mode="create"
        buyers={buyers}
        defaultValues={initialBuyerId ? { buyerId: initialBuyerId } : undefined}
      />
    </div>
  )
}
