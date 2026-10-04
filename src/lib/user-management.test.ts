/**
 * B-205 PR-2（P2-D2〜P2-D4・D-17）: user-management と settings-visibility の純関数の検証（テストランナー非依存・DB 非接続）。
 * 手動実行: `npx tsx src/lib/user-management.test.ts`
 */

import {
  assignableRolesFor,
  availableStatusActions,
  checkActorCanTouch,
  classifyInviteEmail,
  isLastOwnerViolation,
  nextUserStatus,
  statusActionNeedsConfirm,
} from "./user-management"
import {
  canSeeArea,
  canSeeSettingsSection,
  firstVisibleSettingsPath,
  readRolePermissions,
  visibleAreas,
  visibleSettingsSections,
} from "./settings-visibility"
import { canManageCompany, isOwner } from "./permissions"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① 判定の一本化（P2-D5）
{
  assert(canManageCompany("OWNER") && canManageCompany("ADMIN"), "① OWNER / ADMIN は変更できる")
  assert(!canManageCompany("STAFF") && !canManageCompany("EXTERNAL") && !canManageCompany(null) && !canManageCompany(undefined), "①' それ以外は不可")
  assert(isOwner("OWNER") && !isOwner("ADMIN"), "①'' isOwner")
}

// ② 状態の遷移は 4 つだけ（P2-D2）
{
  assert(nextUserStatus("ACTIVE", "suspend") === "SUSPENDED", "② 有効→停止")
  assert(nextUserStatus("SUSPENDED", "resume") === "ACTIVE", "②' 停止→有効")
  assert(nextUserStatus("SUSPENDED", "archive") === "ARCHIVED", "②'' 停止→アーカイブ")
  assert(nextUserStatus("ARCHIVED", "unarchive") === "SUSPENDED", "②''' アーカイブ→停止")
  assert(nextUserStatus("ACTIVE", "archive") === null, "②-4 有効→アーカイブは不可")
  assert(nextUserStatus("ARCHIVED", "resume") === null, "②-5 アーカイブ→再開は不可")
  assert(nextUserStatus("INVITED", "suspend") === null && nextUserStatus("INVITED", "resume") === null, "②-6 招待中は操作なし")
  assert(nextUserStatus("ACTIVE", "resume") === null && nextUserStatus("SUSPENDED", "suspend") === null, "②-7 同じ向きは不可")
  assert(JSON.stringify(availableStatusActions("ACTIVE")) === JSON.stringify(["suspend"]), "②-8 有効の行は「停止」だけ")
  assert(JSON.stringify(availableStatusActions("SUSPENDED")) === JSON.stringify(["resume", "archive"]), "②-9 停止の行は「再開」「アーカイブ」")
  assert(JSON.stringify(availableStatusActions("ARCHIVED")) === JSON.stringify(["unarchive"]), "②-10 アーカイブの行は「停止に戻す」")
  assert(availableStatusActions("INVITED").length === 0, "②-11 招待中は無し")
  assert(statusActionNeedsConfirm("suspend") && statusActionNeedsConfirm("archive") && !statusActionNeedsConfirm("resume") && !statusActionNeedsConfirm("unarchive"), "②-12 確認は停止とアーカイブ（P2-D11）")
}

// ③ 役割のプルダウン（P2-D3・D-14）
{
  const owner = assignableRolesFor("OWNER")
  assert(owner.length === 7 && owner.includes("OWNER") && !owner.includes("EXTERNAL"), "③ オーナーは 7 つ・EXTERNAL 無し")
  const admin = assignableRolesFor("ADMIN")
  assert(admin.length === 6 && !admin.includes("OWNER"), "③' 管理者は「オーナー」を出さない")
  assert(assignableRolesFor("STAFF").length === 0, "③'' それ以外は変えられない")
}

// ④ 操作する人が相手を扱えるか（D-17・P2-D3）
{
  const base = { actorId: "a", targetId: "b" }
  assert(checkActorCanTouch({ ...base, actorRole: "STAFF", targetRole: "STAFF" }).ok === false, "④ 一般スタッフは拒否")
  assert(checkActorCanTouch({ actorRole: "OWNER", actorId: "a", targetId: "a", targetRole: "OWNER", newRole: "ADMIN" }).ok === false, "④' 自分の役割は変えられない")
  assert(checkActorCanTouch({ actorRole: "OWNER", actorId: "a", targetId: "a", targetRole: "OWNER", action: undefined } as never).ok === false, "④'' 自分の状態も変えられない")
  assert(checkActorCanTouch({ ...base, actorRole: "ADMIN", targetRole: "OWNER" }).ok === false, "④''' 管理者はオーナーを扱えない")
  assert(checkActorCanTouch({ ...base, actorRole: "ADMIN", targetRole: "STAFF", newRole: "OWNER" }).ok === false, "④-4 管理者は誰かをオーナーにできない")
  assert(checkActorCanTouch({ ...base, actorRole: "ADMIN", targetRole: "STAFF", newRole: "ACCOUNTING" }).ok === true, "④-5 管理者はオーナー以外を扱える")
  assert(checkActorCanTouch({ ...base, actorRole: "OWNER", targetRole: "OWNER", newRole: "ADMIN" }).ok === true, "④-6 オーナーはオーナーを扱える")
  assert(checkActorCanTouch({ ...base, actorRole: "OWNER", targetRole: "EXTERNAL" }).ok === false, "④-7 社外ユーザーは扱わない")
}

// ⑤ 最後のオーナー（P2-D4）
{
  assert(isLastOwnerViolation({ targetRole: "OWNER", targetStatus: "ACTIVE", newRole: "ADMIN", otherActiveOwnerCount: 0 }), "⑤ 最後のオーナーを管理者にする → 拒否")
  assert(!isLastOwnerViolation({ targetRole: "OWNER", targetStatus: "ACTIVE", newRole: "ADMIN", otherActiveOwnerCount: 1 }), "⑤' 他に有効なオーナーがいれば可")
  assert(isLastOwnerViolation({ targetRole: "OWNER", targetStatus: "ACTIVE", action: "suspend", otherActiveOwnerCount: 0 }), "⑤'' 最後のオーナーを停止 → 拒否")
  assert(!isLastOwnerViolation({ targetRole: "OWNER", targetStatus: "ACTIVE", newRole: "OWNER", otherActiveOwnerCount: 0 }), "⑤''' オーナーのままなら可")
  assert(!isLastOwnerViolation({ targetRole: "ADMIN", targetStatus: "ACTIVE", newRole: "STAFF", otherActiveOwnerCount: 0 }), "⑤-4 相手がオーナーでなければ関係ない")
  assert(!isLastOwnerViolation({ targetRole: "OWNER", targetStatus: "SUSPENDED", action: "archive", otherActiveOwnerCount: 0 }), "⑤-5 既に停止中のオーナーのアーカイブは有効なオーナー数を減らさない")
  assert(!isLastOwnerViolation({ targetRole: "OWNER", targetStatus: "SUSPENDED", action: "resume", otherActiveOwnerCount: 0 }), "⑤-6 再開は減らさない")
}

// ⑥ 見える項目（D-16・D-20・P2-D7・P2-D8）
{
  const empty = readRolePermissions({})
  assert(visibleSettingsSections(empty, "STAFF").length === 4, "⑥ 未設定なら全員「見る」")
  assert(visibleSettingsSections(empty, "OWNER").length === 4 && visibleSettingsSections(empty, "ADMIN").length === 4, "⑥' OWNER / ADMIN は常に全部")
  const perms = readRolePermissions({ rolePermissions: { settings: { bank: { STAFF: "hidden", SALES: "view", OWNER: "hidden", BOGUS: "hidden" }, users: { STAFF: "nope" } } }, other: 1 })
  assert(!canSeeSettingsSection(perms, "STAFF", "bank") && canSeeSettingsSection(perms, "SALES", "bank") && canSeeSettingsSection(perms, "STAFF", "users"), "⑥'' hidden だけ隠す・知らない値は無視")
  assert(canSeeSettingsSection(perms, "OWNER", "bank") && canSeeSettingsSection(perms, "ADMIN", "bank"), "⑥''' OWNER / ADMIN の hidden は書かれていても無視")
  assert(JSON.stringify(visibleSettingsSections(perms, "STAFF")) === JSON.stringify(["company", "users", "display"]), "⑥-4 目次の並びは company → bank → users → display のうち見えるもの")
  assert(firstVisibleSettingsPath(perms, "STAFF") === "/settings/company", "⑥-5 見える最初の項目")
  const allHidden = readRolePermissions({ rolePermissions: { settings: { company: { STAFF: "hidden" }, bank: { STAFF: "hidden" }, users: { STAFF: "hidden" }, display: { STAFF: "hidden" } } } })
  assert(firstVisibleSettingsPath(allHidden, "STAFF") === "/settings/roles", "⑥-6 全部隠すと「役割と権限」へ")
  assert(
    Object.keys(readRolePermissions(null).settings).length === 0 &&
      Object.keys(readRolePermissions("x").settings).length === 0 &&
      Object.keys(readRolePermissions({ rolePermissions: [] }).settings).length === 0,
    "⑥-7 壊れた値は空",
  )
  assert(!canSeeSettingsSection(empty, "EXTERNAL", "company") && !canSeeSettingsSection(empty, null, "company"), "⑥-8 EXTERNAL / 未ログインは見えない")
}

// ⑦ B-253（C-D4）: 招待のときの同じメールの既存の行の分類
{
  const me = "company-a"
  const d = new Date("2026-10-03T00:00:00Z")
  assert(classifyInviteEmail(null, me) === "new", "⑦-1 行が無ければ new")
  assert(classifyInviteEmail({ companyId: me, status: "INVITED", deletedAt: d }, me) === "revive", "⑦-2 同じ会社・INVITED・取り消し済みは revive")
  assert(classifyInviteEmail({ companyId: me, status: "INVITED", deletedAt: null }, me) === "pending", "⑦-3 同じ会社・INVITED・取り消していないは pending")
  assert(classifyInviteEmail({ companyId: me, status: "ACTIVE", deletedAt: null }, me) === "in_use", "⑦-4 有効な人は in_use")
  assert(classifyInviteEmail({ companyId: me, status: "SUSPENDED", deletedAt: null }, me) === "in_use", "⑦-5 停止の人は in_use")
  assert(classifyInviteEmail({ companyId: me, status: "ARCHIVED", deletedAt: null }, me) === "in_use", "⑦-6 アーカイブの人は in_use")
  assert(classifyInviteEmail({ companyId: "company-b", status: "INVITED", deletedAt: d }, me) === "in_use", "⑦-7 他社の取り消した招待は in_use")
  assert(classifyInviteEmail({ companyId: "company-b", status: "INVITED", deletedAt: null }, me) === "in_use", "⑦-8 他社の招待中も in_use")
  assert(classifyInviteEmail({ companyId: me, status: "ACTIVE", deletedAt: d }, me) === "in_use", "⑦-9 同じ会社の削除済みの有効な人は in_use")
}

// ⑧ B-243 PR-1（C-D1〜C-D3）: 画面の領域（areas・発注）
{
  // 1. 空の設定: STAFF は見られない（既定 hidden）・ほかの4役割は見られる
  const empty = readRolePermissions({})
  assert(!canSeeArea(empty, "STAFF", "orders"), "⑧-1 空の設定で STAFF は発注が見えない")
  for (const r of ["PRODUCTION", "ACCOUNTING", "SALES", "DESIGNER"]) {
    assert(canSeeArea(empty, r, "orders"), `⑧-1' 空の設定で ${r} は発注が見える`)
  }
  // 2. OWNER / ADMIN は hidden が書かれていても見られる
  const allHidden = readRolePermissions({ rolePermissions: { areas: { orders: { OWNER: "hidden", ADMIN: "hidden", STAFF: "hidden" } } } })
  assert(canSeeArea(allHidden, "OWNER", "orders") && canSeeArea(allHidden, "ADMIN", "orders"), "⑧-2 OWNER / ADMIN は常に見える")
  // 3. STAFF を view で上書きできる
  const staffView = readRolePermissions({ rolePermissions: { areas: { orders: { STAFF: "view" } } } })
  assert(canSeeArea(staffView, "STAFF", "orders"), "⑧-3 STAFF=view を保存すると見える")
  // 4. SALES を hidden にできる
  const salesHidden = readRolePermissions({ rolePermissions: { areas: { orders: { SALES: "hidden" } } } })
  assert(!canSeeArea(salesHidden, "SALES", "orders") && canSeeArea(salesHidden, "PRODUCTION", "orders"), "⑧-4 SALES=hidden で SALES だけ見えない")
  // 5. EXTERNAL・null・知らない役割は見られない
  assert(!canSeeArea(staffView, "EXTERNAL", "orders") && !canSeeArea(staffView, null, "orders") && !canSeeArea(staffView, "BOGUS", "orders"), "⑧-5 EXTERNAL / 未ログイン / 知らない役割は見えない")
  // 6. 壊れた値は捨てられ、既定値に戻る
  const broken1 = readRolePermissions({ rolePermissions: { areas: [] } })
  const broken2 = readRolePermissions({ rolePermissions: { areas: { bogus: { STAFF: "view" }, orders: { STAFF: "nope", BOGUS: "view" } } } })
  assert(Object.keys(broken1.areas).length === 0 && !canSeeArea(broken1, "STAFF", "orders"), "⑧-6 areas が配列なら捨てて既定（STAFF 隠す）")
  assert(Object.keys(broken2.areas).length === 0 && !canSeeArea(broken2, "STAFF", "orders"), "⑧-6' 知らない area・知らない値は捨てて既定")
  assert(JSON.stringify(visibleAreas(empty, "STAFF")) === "[]" && JSON.stringify(visibleAreas(empty, "SALES")) === JSON.stringify(["orders", "cost", "sales", "delivery", "accounting", "masterTerms"]), "⑧-6'' visibleAreas（B-243 PR-2〜PR-4 で area が 6 つになった）")
  // 7. settings 側は変わらない（既定は「見る」）
  assert(visibleSettingsSections(empty, "STAFF").length === 4, "⑧-7 settings の既定は「見る」のまま")
  assert(Object.keys(readRolePermissions(null).areas).length === 0 && Object.keys(readRolePermissions({ rolePermissions: { settings: { bank: { STAFF: "hidden" } } } }).areas).length === 0, "⑧-7' areas が無くても settings は読める")
}

// ⑨ B-243 PR-2（D2-1）: cost・sales の area
{
  const AREAS = ["orders", "cost", "sales"] as const
  // 1. 空の設定: STAFF は3つとも見られない・他4役割は3つとも見られる
  const empty = readRolePermissions({})
  for (const a of AREAS) {
    assert(!canSeeArea(empty, "STAFF", a), `⑨-1 空の設定で STAFF は ${a} が見えない`)
    for (const r of ["PRODUCTION", "ACCOUNTING", "SALES", "DESIGNER"]) {
      assert(canSeeArea(empty, r, a), `⑨-1' 空の設定で ${r} は ${a} が見える`)
    }
  }
  assert(JSON.stringify(visibleAreas(empty, "STAFF")) === "[]" && JSON.stringify(visibleAreas(empty, "SALES")) === JSON.stringify(["orders", "cost", "sales", "delivery", "accounting", "masterTerms"]), "⑨-1'' visibleAreas（PR-4 で 6 つ）")
  // 2. cost だけ STAFF=view → cost は見える・sales と orders は隠れたまま（area ごとに独立）
  const costView = readRolePermissions({ rolePermissions: { areas: { cost: { STAFF: "view" } } } })
  assert(canSeeArea(costView, "STAFF", "cost") && !canSeeArea(costView, "STAFF", "sales") && !canSeeArea(costView, "STAFF", "orders"), "⑨-2 cost=view は cost だけ")
  // 3. sales.DESIGNER=hidden → DESIGNER だけ sales が見えない
  const dsHidden = readRolePermissions({ rolePermissions: { areas: { sales: { DESIGNER: "hidden" } } } })
  assert(!canSeeArea(dsHidden, "DESIGNER", "sales") && canSeeArea(dsHidden, "DESIGNER", "cost") && canSeeArea(dsHidden, "SALES", "sales"), "⑨-3 sales.DESIGNER=hidden")
  // 4. OWNER / ADMIN は3つとも hidden でも見える・EXTERNAL・null は見えない
  const allHidden = readRolePermissions({ rolePermissions: { areas: { orders: { OWNER: "hidden", ADMIN: "hidden" }, cost: { OWNER: "hidden", ADMIN: "hidden" }, sales: { OWNER: "hidden", ADMIN: "hidden" } } } })
  for (const a of AREAS) {
    assert(canSeeArea(allHidden, "OWNER", a) && canSeeArea(allHidden, "ADMIN", a), `⑨-4 OWNER / ADMIN は ${a} が常に見える`)
    assert(!canSeeArea(costView, "EXTERNAL", a) && !canSeeArea(costView, null, a), `⑨-4' EXTERNAL / 未ログインは ${a} が見えない`)
  }
  // 5. 知らない area（billing）は捨てられる
  const unknown = readRolePermissions({ rolePermissions: { areas: { billing: { STAFF: "view" }, cost: { STAFF: "view" } } } })
  assert(Object.keys(unknown.areas).length === 1 && unknown.areas.cost?.STAFF === "view", "⑨-5 知らない area は捨て、知っている area は残る")
}

// ⑩ B-243 PR-3（D3-1）: delivery・accounting の area
{
  const ALL = ["orders", "cost", "sales", "delivery", "accounting"] as const
  // 1. 空の設定: STAFF は delivery・accounting が見えない・他4役割は5つとも見える
  const empty = readRolePermissions({})
  assert(!canSeeArea(empty, "STAFF", "delivery") && !canSeeArea(empty, "STAFF", "accounting"), "⑩-1 空の設定で STAFF は delivery・accounting が見えない")
  for (const r of ["PRODUCTION", "ACCOUNTING", "SALES", "DESIGNER"]) {
    for (const a of ALL) assert(canSeeArea(empty, r, a), `⑩-1' 空の設定で ${r} は ${a} が見える`)
  }
  // 2. delivery だけ STAFF=view → delivery だけ見える
  const dlvView = readRolePermissions({ rolePermissions: { areas: { delivery: { STAFF: "view" } } } })
  assert(canSeeArea(dlvView, "STAFF", "delivery"), "⑩-2 delivery=view で STAFF は delivery が見える")
  for (const a of ["accounting", "orders", "cost", "sales"] as const) assert(!canSeeArea(dlvView, "STAFF", a), `⑩-2' delivery=view でも STAFF は ${a} が見えない`)
  assert(JSON.stringify(visibleAreas(dlvView, "STAFF")) === JSON.stringify(["delivery"]), "⑩-2'' visibleAreas は delivery だけ")
  // 3. accounting.SALES=hidden → SALES だけ accounting が見えない
  const accHidden = readRolePermissions({ rolePermissions: { areas: { accounting: { SALES: "hidden" } } } })
  assert(!canSeeArea(accHidden, "SALES", "accounting") && canSeeArea(accHidden, "SALES", "delivery") && canSeeArea(accHidden, "ACCOUNTING", "accounting"), "⑩-3 accounting.SALES=hidden")
  // 4. OWNER / ADMIN は5つとも hidden でも見える・EXTERNAL・null は見えない
  const allHidden = readRolePermissions({ rolePermissions: { areas: Object.fromEntries(ALL.map((a) => [a, { OWNER: "hidden", ADMIN: "hidden" }])) } })
  for (const a of ALL) {
    assert(canSeeArea(allHidden, "OWNER", a) && canSeeArea(allHidden, "ADMIN", a), `⑩-4 OWNER / ADMIN は ${a} が常に見える`)
    assert(!canSeeArea(dlvView, "EXTERNAL", a) && !canSeeArea(dlvView, null, a), `⑩-4' EXTERNAL / 未ログインは ${a} が見えない`)
  }
}

// ⑪ B-243 PR-4（D4-1）: masterTerms の area
{
  const ALL = ["orders", "cost", "sales", "delivery", "accounting", "masterTerms"] as const
  // 1. 空の設定: STAFF は masterTerms が見えない・他4役割は見える
  const empty = readRolePermissions({})
  assert(!canSeeArea(empty, "STAFF", "masterTerms"), "⑪-1 空の設定で STAFF は masterTerms が見えない")
  for (const r of ["PRODUCTION", "ACCOUNTING", "SALES", "DESIGNER"]) assert(canSeeArea(empty, r, "masterTerms"), `⑪-1' 空の設定で ${r} は masterTerms が見える`)
  // 2. masterTerms だけ STAFF=view → masterTerms だけ見える
  const mtView = readRolePermissions({ rolePermissions: { areas: { masterTerms: { STAFF: "view" } } } })
  assert(canSeeArea(mtView, "STAFF", "masterTerms"), "⑪-2 masterTerms=view で STAFF は masterTerms が見える")
  for (const a of ["orders", "cost", "sales", "delivery", "accounting"] as const) assert(!canSeeArea(mtView, "STAFF", a), `⑪-2' masterTerms=view でも STAFF は ${a} が見えない`)
  assert(JSON.stringify(visibleAreas(mtView, "STAFF")) === JSON.stringify(["masterTerms"]), "⑪-2'' visibleAreas は masterTerms だけ")
  // 3. OWNER / ADMIN は hidden でも見える・EXTERNAL・null は見えない
  const allHidden = readRolePermissions({ rolePermissions: { areas: Object.fromEntries(ALL.map((a) => [a, { OWNER: "hidden", ADMIN: "hidden" }])) } })
  assert(canSeeArea(allHidden, "OWNER", "masterTerms") && canSeeArea(allHidden, "ADMIN", "masterTerms"), "⑪-3 OWNER / ADMIN は masterTerms が常に見える")
  assert(!canSeeArea(mtView, "EXTERNAL", "masterTerms") && !canSeeArea(mtView, null, "masterTerms"), "⑪-3' EXTERNAL / 未ログインは masterTerms が見えない")
}

console.log("user-management.test.ts: all assertions passed")
