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

