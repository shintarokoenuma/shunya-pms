"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { updateRolePermissions } from "@/lib/actions/role-permissions"
import { CONFIGURABLE_ROLES, ROLE_LABELS, type ConfigurableRole } from "@/lib/constants/user-roles"
import {
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_LABELS,
  type RolePermissions,
  type SectionVisibility,
  type SettingsSection,
} from "@/lib/settings-visibility"

/**
 * B-205 PR-2（D-13・D-16・§4-7）: 「役割と権限」の表。文言はモック案B の原文。
 * - 列: 項目／オーナー／管理者／生産管理／経理／営業／デザイナー／一般スタッフ
 * - オーナー・管理者の列は「変更できる」（固定）。ほかは「見る／隠す」
 * - 行は設定の 4 項目だけ（原価・請求・入金・発注は B-243）。既定は全員「見る」
 * - オーナー・管理者以外は見るだけ（P2-D9）
 */
type Draft = Record<SettingsSection, Record<ConfigurableRole, SectionVisibility>>

function toDraft(perms: RolePermissions): Draft {
  const d = {} as Draft
  for (const s of SETTINGS_SECTIONS) {
    d[s] = {} as Record<ConfigurableRole, SectionVisibility>
    for (const r of CONFIGURABLE_ROLES) d[s][r] = perms.settings[s]?.[r] === "hidden" ? "hidden" : "view"
  }
  return d
}

const VIS_LABELS: Record<SectionVisibility, string> = { view: "見る", hidden: "隠す" }

export function RolePermissionsForm({ perms, canManage }: { perms: RolePermissions; canManage: boolean }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(() => toDraft(perms))
  const [isPending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const r = await updateRolePermissions({ settings: draft })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("役割と権限を保存しました")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">役割と権限</CardTitle>
        <CardDescription>役割ごとに、見せる項目と隠す項目を選びます。オーナーと管理者だけが変えられます</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[110px]">項目</TableHead>
                <TableHead className="min-w-[90px]">{ROLE_LABELS.OWNER}</TableHead>
                <TableHead className="min-w-[90px]">{ROLE_LABELS.ADMIN}</TableHead>
                {CONFIGURABLE_ROLES.map((r) => (
                  <TableHead key={r} className="min-w-[110px]">
                    {ROLE_LABELS[r]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SETTINGS_SECTIONS.map((s) => (
                <TableRow key={s}>
                  <TableCell className="text-sm font-medium">{SETTINGS_SECTION_LABELS[s]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">変更できる</TableCell>
                  <TableCell className="text-sm text-muted-foreground">変更できる</TableCell>
                  {CONFIGURABLE_ROLES.map((r) => (
                    <TableCell key={r} className="text-sm">
                      {canManage ? (
                        <Select
                          value={draft[s][r]}
                          onValueChange={(v) => setDraft({ ...draft, [s]: { ...draft[s], [r]: v as SectionVisibility } })}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 w-[96px]" aria-label={`${SETTINGS_SECTION_LABELS[s]} × ${ROLE_LABELS[r]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">{VIS_LABELS.view}</SelectItem>
                            <SelectItem value="hidden">{VIS_LABELS.hidden}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        VIS_LABELS[draft[s][r]]
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {canManage ? (
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">変えた設定は、その役割の人が次に画面を開いたときに効きます</span>
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
