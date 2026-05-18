"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  page: number
  totalPages: number
  total: number
}

export function ClientsPagination({ page, totalPages, total }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) {
      params.delete("page")
    } else {
      params.set("page", String(p))
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground">
        全 <span className="font-medium text-foreground">{total}</span> 件 /{" "}
        <span className="font-medium text-foreground">{page}</span> /{" "}
        {Math.max(totalPages, 1)} ページ
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
