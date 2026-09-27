/**
 * B-205 PR-2（P2-D2〜P2-D4・D-17）: user-management と settings-visibility の純関数の検証（テストランナー非依存・DB 非接続）。
 * 手動実行: `npx tsx src/lib/user-management.test.ts`
 */

import {
  assignableRolesFor,
  availableStatusActions,
  checkActorCanTouch,
  isLastOwnerViolation,
  nextUserStatus,
  statusActionNeedsConfirm,
} from "./user-management"
import {
  canSeeSettingsSection,
  firstVisibleSettingsPath,
  readRolePermissions,
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

console.log("user-management.test.ts: all assertions passed")
