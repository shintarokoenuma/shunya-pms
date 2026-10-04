# B-243 PR-1 実装ブリーフ — 役割ごとの出し分けの基盤＋発注（2026-10-04）

- 対象: shunya-pms（~/shunya-production-system）・main `3dd8abe` を claude.ai 側で直接読んで作成（2026-10-04 09:57〜10:10 JST）
- 根拠: 慎太郎さんの回答（MEMO_INBOX M-044・ナレッジ claude/MEMO_INBOX-append-2026-10-04.md）
  - 09:48「一般スタッフには非公開にしましょう。」
  - 09:53「一般スタッフに発注権限自体を無しにしたいです。」
  - 09:57「「役割と権限」一般スタッフの発注画面をで見える、見えないも設定できるようにできますか？」
  - 10:04「縫製仕様書は今まで通り出せるようにしてよい。」
  - 10:08「はい、一度、見えない状態で進めて下さい。」（7行・一般スタッフの初期値はすべて見えない・3本の PR）
- ライフサイクル: 横断（基盤）。10月中頃にスタッフが使い始める前提の安全装置
- schema・migration: **なし**（設定は既存の CompanySetting.securitySettings Json に入る）

## 0. 全体の中での位置（3本の PR）

| PR | 行（「役割と権限」に足す） |
|---|---|
| **PR-1（本書）** | 基盤＋「発注」 |
| PR-2 | 「原価・見積」「受注」 |
| PR-3 | 「経理（請求・入金・締め）」「納品」「マスターの取引条件・口座」 |
| 将来 | 「輸出書類」（B-110）・支払（B-212 は経理に入る） |

一般スタッフの初期値はすべて「見えない」、ほかの役割（生産管理・経理・営業・デザイナー）は「見える」。オーナー・管理者は常に見える。

## 1. 決定事項

- **C-D1 名前空間 `areas`**: rolePermissions を `{ settings: {...}, areas: { orders: { STAFF: "hidden", ... } } }` にする。PR-1 の area は `orders` だけ。PR-2 以降は AREA_KEYS に足すだけで済む形にする
- **C-D2 未設定は area ごとの既定値で解く**: `AREA_DEFAULTS.orders = { STAFF: "hidden" }`、書かれていない役割は "view"。★settings 名前空間の「キーが無ければ見る」（B-205 D-16）は変えない
- **C-D3 判定**: OWNER / ADMIN は常に true（canManageCompany）。EXTERNAL・未ログイン・知らない役割は常に false。CONFIGURABLE_ROLES は保存値 → 既定値の順で解く
- **C-D4 判定は画面とサーバの両方**: サイドバーで隠すだけでなく、ページは redirect、Server Action は `{ ok:false, error }` を返す、API は 403
- **C-D5 拒否の文言**: 「この役割では発注を扱えません」（action・API 共通）。ページは /dashboard へ redirect（設定の P2-D8 と同じく無言）
- **C-D6 縫製仕様書は発注と切り離す**（10:04）: 品番カルテの縫製仕様書の宛先候補（WO）と「工場」の表示は、金額を含まない読み取りで作り、発注が見えない役割でも今まで通り出す。`/api/products/[id]/sewing-spec` と `src/lib/pdf/sewing-spec-data.ts` は触らない
- **C-D7 マスターの選択肢の取得は対象外**: `listActiveSuppliersForPoSelect` / `listActiveCostCategoriesForPoSelect` / `listActiveMaterialsForPoSelect` / `listActiveFactoriesForWoSelect` / `listActiveContractorsForWoSelect` / `listActiveCostCategoriesForWoSelect` は品番カルテ・量産見積からも呼ばれる（実測）ため止めない
- **C-D8 「役割と権限」の画面**: 今の表（設定の4行）の下に、同じ形の表「画面」を足す（行は「発注」1つ・説明「仕入 PO・作業 WO」）。オーナー・管理者の列は「変更できる」、ほかは「見る／隠す」。保存ボタンは1つで settings と areas を一緒に保存する
- **C-D9 PR-2・PR-3 へ送るもの**: 原価が見える場所（品番カルテの原価・BOM の PO 取り込み・概算見積の PAST_PO/WO・サンプルのコスト集計・量産見積）は PR-2。納品の引き当て（delivery-allocation.ts が PO/WO を読む）は PR-3。本 PR では触らない

## 2. 作るもの・変えるもの

### 2-1. 純関数（prisma 非依存）
`src/lib/settings-visibility.ts` に足す（同じファイルで settings と並べる）:
- `AREA_KEYS = ["orders"] as const` / `AreaKey`
- `AREA_LABELS = { orders: "発注" }` / `AREA_HINTS = { orders: "仕入 PO・作業 WO" }`
- `AREA_DEFAULTS: Record<AreaKey, Partial<Record<ConfigurableRole, SectionVisibility>>> = { orders: { STAFF: "hidden" } }`
- `RolePermissions` に `areas: Partial<Record<AreaKey, Partial<Record<ConfigurableRole, SectionVisibility>>>>` を足す。`EMPTY_ROLE_PERMISSIONS` も `{ settings: {}, areas: {} }`
- `readRolePermissions` で `rp.areas` を settings と同じ作法で読む（壊れた値・知らないキーは捨てる）
- `canSeeArea(perms, role, area): boolean`（C-D3）
- `visibleAreas(perms, role): AreaKey[]`

### 2-2. サーバの判定（server 専用）
新規 `src/lib/area-access.ts`:
- `getAreaAccess()` … auth() → getRolePermissions(companyId) → `{ role, companyId, perms }`（未ログインは null）
- `checkArea(area): Promise<{ ok: true } | { ok: false; error: string }>` … Server Action の先頭で使う（C-D5 の文言）
- `requireAreaPage(area): Promise<void>` … ページ・layout で使う。未ログインは /login、見えなければ /dashboard へ redirect

### 2-3. 発注の画面（ページ）
- 新規 `src/app/(app)/purchase-orders/layout.tsx` と `src/app/(app)/work-orders/layout.tsx`: `await requireAreaPage("orders")` のあと `children`。一覧・詳細・新規・編集をまとめて止める
- `src/app/(app)/production-estimates/[id]/generate/page.tsx`: 先頭（auth の後）で `await requireAreaPage("orders")`

### 2-4. Server Action
`checkArea("orders")` を **requireSession の直後**に入れる（C-D7 の6関数には入れない）:
- `src/lib/actions/purchase-orders.ts`: generateNextPoNumberPreview / listPurchaseOrders / listPurchaseOrdersByProgressTasks / getPurchaseOrder / createPurchaseOrder / updatePurchaseOrder / deletePurchaseOrder / updatePurchaseOrderStatus
- `src/lib/actions/work-orders.ts`: getWorkOrderCreateContext / generateNextWoNumberPreview / listWorkOrders / listWorkOrdersByProgressTasks / getWorkOrder / createWorkOrder / updateWorkOrder / deleteWorkOrder / updateWorkOrderStatus
- `src/lib/actions/production-order-generation.ts`: generateProductionOrders（auth の直後・123行〜）
- `src/lib/actions/order-link.ts`: getOrderLinkOptions
- ★返り値が配列のもの（`Promise<X[]>`）は既存の未ログイン時と同じく `[]` を返す。ActionResult のものは `{ ok:false, error }`
- ★createPurchaseOrder / createWorkOrder は generateProductionOrders の中からも呼ばれる。二重に判定しても結果は同じなので、そのままでよい

### 2-5. 品番カルテ（C-D6）
`src/lib/actions/product-orders.ts`:
- 今の本体を export しない関数 `loadProductOrderRows(companyId, productId)` に移す
- `getProductOrders(productId)`（今と同じ型）: `checkArea("orders")` が通らなければ `[]`
- 新規 `getProductWoSummaries(productId)`: 発注の判定をしない。返すのは **WO の行だけ**で、`subtotalJpy` と `currency` を含めない型（`ProductWoSummary`）
`src/app/(app)/products/[id]/page.tsx`:
- 221行 `getProductOrders(id)` と並べて `getProductWoSummaries(id)` と「発注が見えるか」を取る
- 281行（工場の導出）と 294行（縫製仕様書の宛先）は **summaries から作る**
- 775行 `<ProductOrdersSection rows={productOrders} />` は発注が見えるときだけ出す。見えないときは「受注・発注」の引き出しは受注だけになる（受注は PR-2 で扱う）

### 2-6. サンプル製作の詳細
- `src/app/(app)/samples/[id]/page.tsx` 74〜75行: action が拒否すると posResult / wosResult が ok:false になり、今のコードで空になる（変更不要）。「発注が見えるか」を取り、`progress-checklist.tsx` に `canSeeOrders` を渡す
- `src/app/(app)/samples/_components/progress-checklist.tsx`（client）: `canSeeOrders` が false なら、タスクごとの PO/WO の一覧（331・348行付近のリンク）と「発注を作成」ボタン2つ（295・305行の Link）を出さない

### 2-7. 量産発注の生成への入口
- `src/app/(app)/production-estimates/[id]/page.tsx` 98行と `src/app/(app)/products/_components/production-estimate-section.tsx` 245行（client）の `/generate` へのリンクを、発注が見えるときだけ出す（section には品番カルテ page.tsx から `canSeeOrders` を prop で渡す）

### 2-8. API（403）
- `src/app/api/purchase-orders/pdf/route.ts` / `src/app/api/work-orders/pdf/route.ts` / `src/app/api/order-pdf-archive/route.ts`: 401 の判定の直後に `checkArea("orders")`。通らなければ `new Response("この役割では発注を扱えません", { status: 403 })`

### 2-9. 全体検索
- `src/lib/actions/global-search.ts`: 発注が見えなければ ③発注（134行・149行）の2本を実行せず `[]` にする（272〜285行の結果も出ない）

### 2-10. サイドバー
- `src/components/app-shell/nav-items.ts`: `NavItem` に `area?: AreaKey` を足し、「発注（仕入 PO）」「発注（作業 WO）」に `area: "orders"`
- `src/components/app-shell/app-shell.tsx`: getRolePermissions と visibleAreas で見える area を出し、`<Sidebar visibleAreas={...} />` と Header（MobileNav 経由）に渡す
- `sidebar.tsx` / `mobile-nav.tsx` / `sidebar-nav.tsx`: `visibleAreas` を受け、`item.area` があって含まれない項目を出さない（hidden と同じ扱い）

### 2-11. 「役割と権限」の画面と保存
- `src/lib/validators/role-permissions.ts`: `areas`（AREA_KEYS × CONFIGURABLE_ROLES・値 "view"|"hidden"・strict）を **optional** で足す
- `src/lib/actions/role-permissions.ts` 70〜90行: 保存時に `rolePermissions: { ...currentRp, settings: next.settings, ...(areas があれば { areas: next.areas }) }`。AuditLog の before/after にも areas を含める
- `src/app/(app)/settings/_components/role-permissions-form.tsx`: Draft を settings と areas の2つに。areas の初期値は **保存値 → AREA_DEFAULTS → "view"** で埋める（C-D2。画面で「一般スタッフ＝隠す」が最初から見える）。表をもう1つ（見出し「画面」）。保存で両方送る。カードの説明文は「役割ごとに、見せる項目と隠す項目を選びます。オーナーと管理者だけが変えられます」のまま
- ★横はみ出しは B-257 の件。今回は表を増やすだけで直さない（同じ書き方を写す）

## 3. テスト

`src/lib/user-management.test.ts` に足す（`npx tsx src/lib/user-management.test.ts`）:
1. 空の設定で STAFF は orders を見られない・PRODUCTION / ACCOUNTING / SALES / DESIGNER は見られる
2. OWNER / ADMIN は areas に hidden が書かれていても見られる
3. `areas.orders.STAFF = "view"` を保存すると STAFF が見られる（初期値を上書きできる）
4. `areas.orders.SALES = "hidden"` で SALES が見られない
5. EXTERNAL・null は見られない
6. 壊れた値（areas が配列・知らない area・知らない値）は捨てられ、既定値に戻る
7. settings 側の既存テストが通る（settings の既定は「見る」のまま）

## 4. 確認（dev・localhost:3001）

★dev-staff@example.test のパスワードは分からなくなっている（CLOSE-AH §7）。先に `DEV_TEST_USER_PASSWORD=<新しい値> npx tsx scripts/dev-create-test-users.ts` を流し直す（dev 専用スクリプト）。役割ごとにウィンドウを分ける。

1. 一般スタッフ（dev-staff）: サイドバーに「発注（仕入 PO）」「発注（作業 WO）」が無い
2. 同: /purchase-orders・/work-orders・/purchase-orders/new・既存の発注の詳細の URL を直接開くと /dashboard に戻る
3. 同: 品番カルテ（量産 WO がある品番）で「受注・発注」の引き出しに発注の一覧が無い。品番・分類の「工場」は出ている。「縫製仕様書」のダイアログで宛先の WO が選べ、プレビューが出る
4. 同: サンプル製作の詳細で、タスクに PO/WO の一覧と「発注を作成」が出ない
5. 同: 量産見積の詳細と品番カルテの見積で「量産発注を生成」が出ない。/production-estimates/[id]/generate を直接開くと /dashboard に戻る
6. 同: 全体検索で発注番号を入れても発注が出ない
7. 同: ブラウザのコンソールから発注書 PDF の API を POST すると 403（任意）
8. 生産管理（dev-production）: 1〜6 がすべて今まで通り見える・使える
9. 管理者で「役割と権限」: 「画面」の表に「発注」行があり、一般スタッフが「隠す」、ほかが「見る」。一般スタッフを「見る」にして保存 → 一般スタッフのウィンドウで画面を開き直すとサイドバーに発注が出る → 「隠す」に戻す
10. 管理者で「役割と権限」の設定の4行が今まで通り保存できる（areas を足したことで settings が消えない）

## 5. 本番への影響

- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）
- 本番の User は 2026-10-04 09:47 の画面でオーナー1人（招待中なし）。一般スタッフはいないため、マージしても見え方が変わる人はいない
- migration なし。本番の CompanySetting は書き換えない（既定値はコード側で解く）

## 6. 作業の約束

- ブランチ `feat/b243-pr1-orders-visibility`。コードを含むので PR 必須（main 直 push 禁止）
- 型（`npx tsc --noEmit`）・触ったファイルの lint・テストが通れば commit → push → PR open まで進めてよい。マージは慎太郎さん
- 新しいクエリは companyId と deletedAt: null を手書き（AGENTS.md）
- 本書を `docs/specs/b-243-pr1-implementation-brief-2026-10-04.md` として PR に同梱する

## 7. 本 PR で作らないもの

- 「見えるが編集できない」段階（今の仕組みは見える／見えないの2択・10:04 の提案で合意）
- 仕入 PO と作業 WO を別々に切り替えること（「発注」1行）
- 原価・受注・納品・経理・マスターの取引条件の行（PR-2・PR-3）
- 「役割と権限」の表のはみ出し（B-257）

END-OF-BRIEF-B243-PR1
