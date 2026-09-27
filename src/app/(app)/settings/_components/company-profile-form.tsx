"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateCompanyProfile } from "@/lib/actions/company-profile"
import type { CompanyProfileView } from "@/lib/validators/company-profile"

/**
 * B-205 PR-1（spec v1.0 §3-2・D-3・D-11・D-15）: 「自社情報」のカード。文言はモック案B の原文。
 * - 入力欄: 表示名／正式名称／郵便番号／住所／電話／FAX／メール／Webサイト／登録番号
 * - 電話・FAX・メール・郵便番号は番号・アドレスだけ（「TEL:」「〒」は帳票側で付ける）
 * - 空の欄は「未登録」。OWNER / ADMIN 以外は見るだけ（入力欄を読み取り専用にし「保存」を出さない・サーバ側でも拒否）
 */
type Field = { key: keyof CompanyProfileView; label: string; placeholder?: string; multiline?: boolean; hint?: string }

const FIELDS: Field[] = [
  { key: "companyName", label: "表示名", placeholder: "例: shunya", hint: "画面の右上に出ます" },
  { key: "legalEntity", label: "正式名称", placeholder: "例: 株式会社shunya", hint: "帳票の社名。空なら表示名が出ます" },
  { key: "postalCode", label: "郵便番号", placeholder: "例: 150-0043", hint: "「〒」は帳票側で付けます" },
  { key: "address", label: "住所", placeholder: "例: 東京都渋谷区…", multiline: true },
  { key: "phone", label: "電話", placeholder: "例: 03-1234-5678", hint: "番号だけ（「TEL:」は帳票側で付けます）" },
  { key: "fax", label: "FAX", placeholder: "例: 03-1234-5679", hint: "番号だけ（「FAX:」は帳票側で付けます）" },
  { key: "email", label: "メール", placeholder: "例: info@example.com", hint: "アドレスだけ（「MAIL:」は帳票側で付けます）" },
  { key: "website", label: "Webサイト", placeholder: "例: https://example.com" },
  { key: "taxId", label: "登録番号", placeholder: "例: T1234567890123", hint: "適格請求書発行事業者番号（T＋13桁）" },
]

export function CompanyProfileForm({ profile, canManage }: { profile: CompanyProfileView; canManage: boolean }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Record<keyof CompanyProfileView, string>>(() => {
    const d = {} as Record<keyof CompanyProfileView, string>
    for (const f of FIELDS) d[f.key] = profile[f.key] ?? ""
    return d
  })
  const [isPending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const r = await updateCompanyProfile(draft)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("自社情報を保存しました")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">自社情報</CardTitle>
        <CardDescription>請求書・納品書・発注書に載ります</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.multiline ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}>
              <Label htmlFor={`company-${f.key}`}>{f.label}</Label>
              {canManage ? (
                f.multiline ? (
                  <Textarea
                    id={`company-${f.key}`}
                    value={draft[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    placeholder={f.placeholder ?? "未登録"}
                    rows={2}
                    disabled={isPending}
                  />
                ) : (
                  <Input
                    id={`company-${f.key}`}
                    value={draft[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    placeholder={f.placeholder ?? "未登録"}
                    disabled={isPending}
                  />
                )
              ) : (
                <p id={`company-${f.key}`} className="min-h-8 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm">
                  {profile[f.key] ? (
                    <span className="whitespace-pre-wrap">{profile[f.key]}</span>
                  ) : (
                    <span className="text-muted-foreground">未登録（帳票には空欄で出ます）</span>
                  )}
                </p>
              )}
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>
        {canManage ? (
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">この欄だけ保存します</span>
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
