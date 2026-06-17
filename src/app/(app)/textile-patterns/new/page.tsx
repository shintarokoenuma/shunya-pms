import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listActivePatternTypes } from "@/lib/actions/textile-patterns"
import { TextilePatternForm } from "../_components/textile-pattern-form"

export default async function NewTextilePatternPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const patternTypes = await listActivePatternTypes()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/textile-patterns">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">柄 新規作成</h1>
        <p className="text-sm text-muted-foreground">
          新しい柄（D#）を登録します。表示順を空欄にすると末尾に追加されます。
        </p>
      </div>
      <TextilePatternForm mode="create" patternTypes={patternTypes} />
    </div>
  )
}
