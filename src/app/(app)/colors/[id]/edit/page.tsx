import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getColor } from "@/lib/actions/colors"
import { ColorForm } from "../../_components/color-form"
import type {
  ColorFormValues,
  ColorStatusValue,
} from "@/lib/validators/color"

type Params = Promise<{ id: string }>

export default async function EditColorPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const color = await getColor(id)
  if (!color) notFound()

  const initialValues: Partial<ColorFormValues> = {
    colorNumber: color.colorNumber,
    colorName: color.colorName,
    colorNameEn: color.colorNameEn ?? "",
    cmyk: color.cmyk,
    hex: color.hex,
    impression: color.impression ?? "",
    status: color.status as ColorStatusValue,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/colors/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">カラー 編集</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          #{color.colorNumber} / {color.colorName}
        </p>
      </div>
      <ColorForm mode="edit" initialId={id} initialValues={initialValues} />
    </div>
  )
}
