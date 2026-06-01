import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ColorForm } from "../_components/color-form"

export default async function NewColorPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/colors">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">カラー 新規作成</h1>
        <p className="text-sm text-muted-foreground">
          新しい色を登録します。色番号 2 桁から色相系統・トーン段階は自動算出されます。
        </p>
      </div>
      <ColorForm mode="create" />
    </div>
  )
}
