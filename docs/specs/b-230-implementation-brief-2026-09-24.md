# B-230 実装ブリーフ — テナント分離 PR-1（受注の所有確認2件・誤解コメント・ルール明文化）

- 作成: 2026-09-24
- 起点: MEMO_INBOX M-036（read-only 調査・main 049fbb8）／BACKLOG B-230
- 種別: コード変更を含む → feature ブランチ＋PR（マージは慎太郎さん）
- 本番影響: なし（schema 変更・migration なし。挙動が変わるのは「他社の id が渡された時」だけで、現在の DB は1社のみ）

## 背景（要点）
- src/lib/prisma.ts の Extension（companyId / deletedAt の自動注入）は withTenantContext で包んだ時だけ動く。包んでいるのは brands.ts / clients.ts のみ。
- sales-orders.ts は包まれていないのに「TENANT: companyId 自動注入」と誤解したコメントがあり、所有確認が抜けている箇所が2つある。
- 方針は「companyId の手書きを正式ルールにする」（慎太郎さん承認 2026-09-24）。

## 変更1: 受注作成の取引先の所有確認（src/lib/actions/sales-orders.ts）
- afb6924 時点の 478〜482 行付近。行番号ではなく、コメント「クライアント所有確認（TENANT: companyId 自動注入）」の直後の prisma.client.findFirst を対象にする。
- where を { id: data.clientId } → { id: data.clientId, companyId: sess.companyId } にする。
- deletedAt は足さない（既存挙動を変えない）。

## 変更2: 明細 SKU の所有確認（同ファイル buildAndValidateItems）
- afb6924 時点の 210 行付近。引数に companyId: string を受け取っている関数内の prisma.sku.findMany({ where: { id: { in: allSkuIds } } })。
- where に companyId を足す（{ id: { in: allSkuIds }, companyId }）。
- deletedAt は足さない（削除済み SKU を含む既存受注の編集が失敗するようになるため）。
- この関数は受注作成・受注更新の両方から呼ばれている（sess.companyId を渡している）ことを確認してから変更する。

## 変更3: 誤解コメントの修正（同ファイル）
- 「TENANT: companyId 自動注入」「TENANT: companyId/deletedAt 自動注入」と書かれたコメント3箇所（afb6924 時点 :478・:896・:978）を、実態に合わせて「このファイルは withTenantContext 外。companyId は手書きで明示する」旨に書き換える。
- :896・:978 付近のクエリ自体は、所有確認済みの親（品番や SO）の条件で絞れているため変更しない（M-036 実測）。

## 変更4: ルールの明文化
- repo でコーディング規約を置いている場所を実測する（AGENTS.md / CLAUDE.md / docs/ 配下）。置き場所が判断できなければ止めて報告する。
- 次を追記する:
  - companyId を持つモデルへのクエリは where に companyId を手書きする。新しく書くコードは deletedAt: null も手書きする。
  - companyId を持たない子テーブル（明細など）は、親を companyId 付きで取得して所有を確認してから触る。
  - src/lib/prisma.ts の Extension は withTenantContext で包んだ brands.ts / clients.ts の中でしか効かない。他のファイルで自動注入を当てにしない。
  - 根拠: MEMO_INBOX M-036、BACKLOG B-230〜B-232。

## 対象外（この PR で触らない）
- 他ファイルの呼び出し、Extension 本体・tenant-models.ts、物理削除（B-232）、書き忘れ検出（B-231）、EXTERNAL ロール（B-172）。

## 検証
- 型チェック（tsc）がクリーン。lint は触ったファイルで新しいエラーが無いこと（全体 lint は既存エラー数が増えていないことの確認に使う）。
- git diff で、変更が sales-orders.ts のクエリ2箇所・コメント3箇所とルール文書だけであることを示す。
- dev（localhost:3001・dev DB）で、受注の新規作成と既存受注の編集が従来どおり通ること。
- 他社の id を渡す否定テストは、dev に2社目が無いためコードレビューで確認する（where に companyId が入っていることを diff で示す）。

## Git
- feature ブランチで作業し、型・lint がクリーンなら commit → push → PR open まで進めてよい。マージは慎太郎さん。
