<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Phase 1A-9 候補（既知の拡張ニーズ）

### Currency enum 拡張
現状: `JPY / USD / CNY / VND / EUR`（5種類）

将来の取引拡大に合わせて追加検討：
- `KRW`（韓国ウォン）
- `THB`（タイバーツ）
- `INR`（インドルピー）
- `TRY`（トルコリラ）
- `GBP`（英ポンド）

対応場所: `prisma/schema.prisma` の `enum Currency` + `src/lib/constants/currencies.ts`

### Language enum 拡張
現状: `JA / EN / ZH / VI`（4種類）

将来の取引拡大に合わせて追加検討：
- `KO`（韓国語）

対応場所: `prisma/schema.prisma` の `enum Language` + `src/lib/constants/languages.ts`

### トリガー条件
韓国・タイ・インド・トルコ・英国の取引先 / 工場が登録される直前に Phase 1A-9 として実施。



---

## 🏭 マスター実装パターン（重要）

shunya プロジェクトのマスター CRUD 実装は **`docs/shunya-master-patterns.md`** を参照すること。

- ファイル配置規約 / 命名規約 / スキーマパターン / Server Action 構成
- archive/restore/permanent delete 分離パターン
- 共通モジュール（src/lib/constants/）の使い方
- アンチパターン集
- 実装チェックリスト

新しいマスター（外注先・納品先・素材等）を実装する際は、**まずこのドキュメントを読んでから**着手すること。


---

## 🔒 テナント分離（companyId）の書き方（B-230・2026-09-25）

根拠: `docs/MEMO_INBOX.md` M-036（2026-09-24 の read-only 棚卸し）、`docs/BACKLOG.md` B-230〜B-232。

- **`companyId` を持つモデルへのクエリは、where に `companyId` を手書きする。** 新しく書くコードは `deletedAt: null` も手書きする（既存コードに `deletedAt` を後から足す時は、削除済み行を含む既存データの編集が失敗しないかを確認する）。
- **`companyId` を持たない子テーブル**（明細・履歴など。PoItem / WoItem / SoItem / BomItem / DeliveryNoteItem / InvoiceItem / ProductionEstimateItem など）は、**親を `companyId` 付きで取得して所有を確認してから触る。** id だけで子を引いて済ませない。
- **`src/lib/prisma.ts` の Extension（companyId / deletedAt の自動注入・物理削除の例外化）は、`withTenantContext()` で包んだ `src/lib/actions/brands.ts` と `src/lib/actions/clients.ts` の中でしか効かない。** 他のファイルでは `TENANT_MODELS` に入っているモデル（Client / Product / Sku など）でも自動注入は起きない。「TENANT なので自動注入される」と書いたコメントや前提を置かない。
- 一覧の `where` を変数で組む場合は、その変数の先頭で `companyId: sess.companyId` を入れる（`purchase-orders.ts` の `listPurchaseOrders` と同じ形）。
- 書き忘れの機械的な検出（B-231）と、物理削除 22 箇所の意図確認（B-232）は別 PR で扱う。
