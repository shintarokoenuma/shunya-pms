"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateCompanyBankAccount } from "@/lib/actions/company-profile"
import type { CompanyBankAccountView } from "@/lib/validators/company-profile"

/**
 * B-205 PR-1（spec v1.0 §3-2・P1-D2）: 「振込先」のカード。文言はモック案B の原文。
 * - 入力欄: 銀行名／支店名／口座種別／口座番号／口座名義。5 項目をすべて入れるか、すべて空か（一部だけは保存できない）
 * - OWNER / ADMIN 以外は見るだけ
 */
const FIELDS: { key: keyof CompanyBankAccountView; label: string; placeholder: string }[] = [
  { key: "bankName", label: "銀行名", placeholder: "例: みずほ銀行" },
  { key: "branchName", label: "支店名", placeholder: "例: 渋谷中央支店" },
  { key: "accountType", label: "口座種別", placeholder: "例: 普通" },
  { key: "accountNumber", label: "口座番号", placeholder: "例: 1234567" },
  { key: "accountHolder", label: "口座名義", placeholder: "例: 株式会社shunya" },
]

const EMPTY: CompanyBankAccountView = { bankName: "", branchName: "", accountType: "", accountNumber: "", accountHolder: "" }

export function BankAccountForm({ bank, canManage }: { bank: CompanyBankAccountView | null; canManage: boolean }) {
  const router = useRouter()
  const [draft, setDraft] = useState<CompanyBankAccountView>(bank ?? EMPTY)
  const [isPending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const r = await updateCompanyBankAccount(draft)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(r.data.bank ? "振込先を保存しました" : "振込先を空にしました")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">振込先</CardTitle>
        <CardDescription>請求書を作るときに写し取ります。発行済みの請求書は変わりません</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`bank-${f.key}`}>{f.label}</Label>
              {canManage ? (
                <Input
                  id={`bank-${f.key}`}
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  disabled={isPending}
                />
              ) : (
                <p id={`bank-${f.key}`} className="min-h-8 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm">
                  {bank?.[f.key] ? bank[f.key] : <span className="text-muted-foreground">未登録</span>}
                </p>
              )}
            </div>
          ))}
        </div>
        {canManage ? (
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">5 項目をすべて入れるか、すべて空にします</span>
            <Button type="button" onClick={save} disabled={isPending}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">変更できるのはオーナーと管理者だけです。</p>
        )}
      </CardContent>
    </Card>
  )
}
