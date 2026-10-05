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
  AREA_HINTS,
  AREA_KEYS,
  AREA_LABELS,
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_LABELS,
  areaVisibilityFor,
  type AreaKey,
  type RolePermissions,
  type SectionVisibility,
  type SettingsSection,
} from "@/lib/settings-visibility"

/**
 * B-205 PR-2（D-13・D-16・§4-7）: 「役割と権限」の表。文言はモック案B の原文。
 * - 列: 項目／オーナー／管理者／生産管理／経理／営業／デザイナー／一般スタッフ
 * - オーナー・管理者の列は「変更できる」（固定）。ほかは「見る／隠す」
 * - 行は設定の 4 項目。既定は全員「見る」
 * - オーナー・管理者以外は見るだけ（P2-D9）
 * B-243 PR-1（C-D8・§2-11）: 同じ形の表「画面」を下に足す（行は「発注」）。初期値は保存値 → AREA_DEFAULTS → "view"（一般スタッフは最初から「隠す」）。
 * 保存ボタンは1つで settings と areas を一緒に送る。横のはみ出しは B-257（今回は同じ書き方を写すだけ）
 */
type Draft = Record<SettingsSection, Record<ConfigurableRole, SectionVisibility>>
type AreaDraft = Record<AreaKey, Record<ConfigurableRole, SectionVisibility>>

function toDraft(perms: RolePermissions): Draft {
  const d = {} as Draft
  for (const s of SETTINGS_SECTIONS) {
    d[s] = {} as Record<ConfigurableRole, SectionVisibility>
    for (const r of CONFIGURABLE_ROLES) d[s][r] = perms.settings[s]?.[r] === "hidden" ? "hidden" : "view"
  }
  return d
}

function toAreaDraft(perms: RolePermissions): AreaDraft {
  const d = {} as AreaDraft
  for (const a of AREA_KEYS) {
    d[a] = {} as Record<ConfigurableRole, SectionVisibility>
    for (const r of CONFIGURABLE_ROLES) d[a][r] = areaVisibilityFor(perms, a, r)
  }
  return d
}

const VIS_LABELS: Record<SectionVisibility, string> = { view: "見る", hidden: "隠す" }

export function RolePermissionsForm({ perms, canManage }: { perms: RolePermissions; canManage: boolean }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(() => toDraft(perms))
  const [areaDraft, setAreaDraft] = useState<AreaDraft>(() => toAreaDraft(perms))
  const [isPending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const r = await updateRolePermissions({ settings: draft, areas: areaDraft })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("役割と権限を保存しました")
      router.refresh()
    })
  }

  // B-257（D-1・D-3）: 項目の列は左に固定（横スクロールしても行名が残る・右端に線）。役割の列は最小幅を決めず中身に任せる
  // B-260（D-1〜D-3）: 行に group を付け、固定セルには行の hover（bg-muted/50）と同じ見え方の色を color-mix で不透明に作って付ける
  // （固定セルは横スクロールで下の列を隠すため不透明でなければならず、bg-muted/50 をそのまま付けると透ける）。Select を開いている間も同じ
  const STICKY_ROW_BG =
    "group-hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] group-has-aria-expanded:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]"
  const headerRow = (
    <TableRow className="group">
      <TableHead className={`sticky left-0 z-10 min-w-[110px] border-r bg-card ${STICKY_ROW_BG}`}>項目</TableHead>
      <TableHead>{ROLE_LABELS.OWNER}</TableHead>
      <TableHead>{ROLE_LABELS.ADMIN}</TableHead>
      {CONFIGURABLE_ROLES.map((r) => (
        <TableHead key={r}>{ROLE_LABELS[r]}</TableHead>
      ))}
    </TableRow>
  )

  const visibilityCell = (
    value: SectionVisibility,
    ariaLabel: string,
    onChange: (v: SectionVisibility) => void,
  ) =>
    canManage ? (
      <Select value={value} onValueChange={(v) => onChange(v as SectionVisibility)} disabled={isPending}>
        <SelectTrigger className="h-8 w-[84px]" aria-label={ariaLabel}>
          {/* B-258 の対策（PR #180 と同じ）: 表示する文字を直接渡す */}
          <SelectValue>{VIS_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="view">{VIS_LABELS.view}</SelectItem>
          <SelectItem value="hidden">{VIS_LABELS.hidden}</SelectItem>
        </SelectContent>
      </Select>
    ) : (
      VIS_LABELS[value]
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">役割と権限</CardTitle>
        <CardDescription>役割ごとに、見せる項目と隠す項目を選びます。オーナーと管理者だけが変えられます</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* B-257（D-4）: 横スクロールの入れ物は Table 自身のものだけにする（sticky が効く入れ物を1つにする） */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>{headerRow}</TableHeader>
            <TableBody>
              {SETTINGS_SECTIONS.map((s) => (
                <TableRow key={s} className="group">
                  <TableCell className={`sticky left-0 z-10 border-r bg-card text-sm font-medium ${STICKY_ROW_BG}`}>{SETTINGS_SECTION_LABELS[s]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">変更できる</TableCell>
                  <TableCell className="text-sm text-muted-foreground">変更できる</TableCell>
                  {CONFIGURABLE_ROLES.map((r) => (
                    <TableCell key={r} className="text-sm">
                      {visibilityCell(draft[s][r], `${SETTINGS_SECTION_LABELS[s]} × ${ROLE_LABELS[r]}`, (v) =>
                        setDraft({ ...draft, [s]: { ...draft[s], [r]: v } }),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* B-243 PR-1（C-D8）: 画面の領域。行は「発注」 */}
        <div>
          <h3 className="mb-2 text-sm font-medium">画面</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>{headerRow}</TableHeader>
              <TableBody>
                {AREA_KEYS.map((a) => (
                  <TableRow key={a} className="group">
                    {/* B-257（D-2）: 項目の幅を決めて説明は折り返す。ラベルは1行のまま */}
                    <TableCell className={`sticky left-0 z-10 w-[168px] min-w-[168px] whitespace-normal border-r bg-card text-sm ${STICKY_ROW_BG}`}>
                      <div className="whitespace-nowrap font-medium">{AREA_LABELS[a]}</div>
                      <div className="text-xs text-muted-foreground">{AREA_HINTS[a]}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">変更できる</TableCell>
                    <TableCell className="text-sm text-muted-foreground">変更できる</TableCell>
                    {CONFIGURABLE_ROLES.map((r) => (
                      <TableCell key={r} className="text-sm">
                        {visibilityCell(areaDraft[a][r], `${AREA_LABELS[a]} × ${ROLE_LABELS[r]}`, (v) =>
                          setAreaDraft({ ...areaDraft, [a]: { ...areaDraft[a], [r]: v } }),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
