import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ClientForm } from "../_components/client-form"

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link href="/clients">
            <ChevronLeft className="size-4" />
            クライアント一覧へ
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          クライアント新規作成
        </h1>
      </div>

      <ClientForm mode="create" />
    </div>
  )
}
