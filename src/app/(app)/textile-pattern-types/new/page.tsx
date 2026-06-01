import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { TextilePatternTypeForm } from "../_components/textile-pattern-type-form"

export default async function NewTextilePatternTypePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/textile-pattern-types">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">柄種別 新規作成</h1>
        <p className="text-sm text-muted-foreground">
          新しい柄種別を登録します。表示順を空欄にすると末尾に追加されます。
        </p>
      </div>
      <TextilePatternTypeForm mode="create" />
    </div>
  )
}
