# Phase 1A 改善バックログ

Phase 1A の動作確認 / 業務確認の過程で見つかった改善案を、優先度付きで記録するライブドキュメント。
各項目が完了したら「対応済み」セクションに移動する。

---

## 未対応

### B-001: Supplier 編集画面で「適格請求書発行事業者」OFF 時の Contractor 誘導アラート

- **記録日**: 2026-05-27
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 中
- **目安タイミング**: Phase 1A 完了後または手すきの時に対応

#### 背景

shunya の業務設計では、取引先を以下のように使い分けている：

- **Supplier（仕入先）**：適格請求書発行事業者を前提とした取引先
- **Contractor（外注先）**：適格請求書発行事業者ではない仕入先 / 個人事業主

Supplier 編集画面で `isQualifiedInvoiceIssuer` を OFF に切り替えると、業務設計上は「この取引先は本来 Contractor として管理すべき」というシグナルになる。

#### 改善内容

Supplier 編集画面で `isQualifiedInvoiceIssuer` チェックボックスが OFF に切り替えられた瞬間、以下のアラート（Alert または Tooltip）を表示する：

> 「適格請求書発行事業者ではない場合は、Contractor（外注先）マスターでの管理が推奨されます。詳細は『取引先マスター使い分けガイド』を参照してください。」

可能であれば「Contractor として新規作成 →」のリンクボタンも添える。

#### 実装ヒント

- `src/app/(app)/suppliers/_components/supplier-form.tsx` の `isQualifiedInvoiceIssuer` Field 配下に条件付き Alert を配置
- `form.watch("isQualifiedInvoiceIssuer")` で監視
- 値が false かつ初期値が true（既存 Supplier の変更）の時にだけ目立つ警告色で表示
- 新規作成時はサラッと薄めの案内に留める

---

### B-002: Material 詳細で archived カテゴリの視覚化

- **記録日**: 2026-05-28
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 低
- **出所**: Phase 1A-15 PR #32 セルフレビュー Finding #3

#### 背景

`getMaterial` は include の status フィルタなしで category を取得しているため、archived な MaterialCategory も普通の Link として描画される。ユーザーは紐付くカテゴリが廃番状態であることに気付けない。

#### 改善内容

`src/app/(app)/materials/[id]/page.tsx` で `item.category.status === ARCHIVED` の場合、取消線または「アーカイブ済み」badge を表示する。`MaterialCategorySummary` 型に `status` を加える必要がある。

---

### B-003: createMaterial / updateMaterial で categoryId の検証

- **記録日**: 2026-05-28
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 中
- **出所**: Phase 1A-15 PR #32 セルフレビュー Finding #4

#### 背景

`createMaterial` / `updateMaterial` は入力された `categoryId` の存在・テナント・status を検証していない。

- 不在の id → Postgres FK 違反で generic catch メッセージに落ち、原因が伝わらない
- 別 company の id → グローバル unique な id なので FK は通り、Material が他社カテゴリへ silent リンクされる
- ARCHIVED の id → 通常通り通る（archive 後に新規 Material から選ばれなくとも、API 直叩きで設定可能）

`primarySupplierId` は existence + tenant チェックがあるのと非対称。

#### 改善内容

- `categoryId` が指定されている時のみ、`prisma.materialCategory.findFirst({ id, companyId, deletedAt: null, status: ACTIVE })` を実行
- 不在・別 company・ARCHIVED の場合はそれぞれユーザ向けエラーを返す
- 同じ pre-existing 穴が `src/lib/actions/model-codes.ts` の ProductCategory `categoryId` にもあるため、対象を Material と ModelCode の両方に拡大検討

---

### B-004: MaterialCategoryForm の level toggle 時 fetch race

- **記録日**: 2026-05-28
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 低
- **出所**: Phase 1A-15 PR #32 セルフレビュー Finding #5

#### 背景

`src/app/(app)/material-categories/_components/material-category-form.tsx` の line 86 付近で、level が変わる度に `listMaterialCategoryParentCandidates` を呼んでいる。AbortController も race ガードも無いため、Lv1 → Lv2 → Lv3 と素早くトグルすると Lv2 の結果が Lv3 toggle 後に上書きする可能性がある。

#### 改善内容

`useEffect` 内で `AbortController` を生成し、依存変更時に `abort()` する。`finally` でローディング解除も signal 越しに無効化。

---

### B-005: migration の既存行 NOT NULL ガード（汎用パターン）

- **記録日**: 2026-05-28
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 低
- **出所**: Phase 1A-15 PR #32 セルフレビュー Finding #6

#### 背景

Phase 1A-15 migration では `ALTER TABLE material_categories ADD COLUMN ... NOT NULL DEFAULT ...` を実行している。「既存 0 件のため安全」というコメントはあるが SQL では担保されておらず、何らかの理由で既存行があると default 値で silent backfill される。

#### 改善内容

NOT NULL DEFAULT を新カラムに追加する migration を書く際の運用ルールを `docs/shunya-master-patterns.md` 等にまとめる。最低限、migration 内で `DO $$ BEGIN IF (SELECT COUNT(*) FROM ...) > 0 THEN RAISE ...; END IF; END $$;` 形式の前提アサートを入れるテンプレートを用意。

---

### B-006: Material の auditLog に categoryId を含める

- **記録日**: 2026-05-28
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 中
- **出所**: Phase 1A-15 PR #32 セルフレビュー Finding #7

#### 背景

`createMaterial` / `updateMaterial` の auditLog `afterData` / `beforeData` には `categoryId` が含まれていない（`materialCode / Name / Type / supplier / status` のみ）。Material のカテゴリ変更履歴が auditLog に残らないため、後から「いつ誰がカテゴリを変えたか」が追えない。

#### 改善内容

`src/lib/actions/materials.ts` の `createMaterial` / `updateMaterial` の audit ペイロードに `categoryId` を追加。

---

### B-007: カテゴリ階層ヘルパーの共通化（Phase 1B 既知）

- **記録日**: 2026-05-28
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 中（Phase 1B）
- **出所**: Phase 1A-15 PR #32 セルフレビュー Finding #8 / 議事録 `phase1a-15-spec-confirmation-2026-05-28.md` §10.5

#### 背景

`validateHierarchy` / `checkCircularReference` / `buildBreadcrumb` が ProductCategory と MaterialCategory で事実上 copy-paste されている。Phase 1A-16 以降で 3 つ目のカテゴリマスターが追加されると 3 重複となり、階層深さや循環判定ルールを変える時に修正漏れリスクが上がる。

#### 改善内容

共通モジュール（例: `src/lib/utils/category-hierarchy.ts`）に汎用ヘルパーとして切り出し、ProductCategory / MaterialCategory / 今後の階層マスターから利用する。型定義（`CategoryCodeSuggestion` 等）の共通化と合わせて Phase 1B のリファクタタスクとして扱う。

---

### B-008: updateMaterialCategory の parent findFirst 重複呼び出し最適化

- **記録日**: 2026-05-28
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 低
- **出所**: Phase 1A-15 PR #32 セルフレビュー Finding #9

#### 背景

`updateMaterialCategory` は `validateHierarchy` → `checkCircularReference` の順で呼んでおり、両関数とも同じ parent を `findFirst` で取得する。1 回の編集で常に 2 回 DB hit するため素直に冗長。

#### 改善内容

`src/lib/actions/material-categories.ts` の `updateMaterialCategory` で、parent の取得を 1 回にまとめ、両チェックに使い回す。階層深さチェックと循環参照チェックは同じ親情報で判断できる。

---

### B-009: Prisma `$transaction` のタイムアウトを bulk 処理向けに拡張する運用ルール

- **記録日**: 2026-05-28
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 中（CSV インポート機能を実装する前までに対応）
- **出所**: `chore/seed-categories`（標準カテゴリ初期投入スクリプト）の実装で発覚

#### 背景

`prisma.$transaction(async (tx) => { ... })` の interactive transaction は、既定で `timeout: 5000ms` / `maxWait: 2000ms`。シーケンシャルに数十件の `findFirst` + `create` を実行する処理ではこの 5 秒を超えやすく、超えた瞬間に以降のクエリが全部 `Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore` で落ちる。

`scripts/seed-categories.ts` の dry-run でも、26 件中 8 件 commit した時点で transaction が expire し、残り 18 件が全部エラーになる症状で気付いた。`{ maxWait: 15_000, timeout: 120_000 }` を渡して解消。

#### 改善内容

1. `docs/shunya-master-patterns.md` に「`$transaction` で `for` ループや件数の多いバルク処理を回す場合は、必ず `timeout` / `maxWait` を明示する」と運用ルールを追記
2. 既知の bulk 操作箇所（seed script・将来の CSV インポート・auditLog の bulk insert 等）で同じ罠を踏まないよう、必要なら共通ヘルパー（例: `withBulkTransaction(prisma, fn)`）を用意
3. Phase 1A-14 で予定されている **CSV インポート機能**（顧客 / Material / ModelCode 等の取り込み）を実装する際の前提として参照

#### 参考値

- 通常の単発トランザクション: 既定のままで OK
- 数十件 〜 数百件: `{ maxWait: 15_000, timeout: 120_000 }` 目安
- 数千件: 分割コミット（バッチ）に切り替える方が安全

---

## 対応済み

（まだなし）

---

## 運用ルール

- 1 項目につき 1 セクション、見出しは `### B-NNN: 短いタイトル`
- 「対応済み」へ移動する際は、その下に「対応 PR: #XX」「対応日: YYYY-MM-DD」を追記
- 軽い改善は本 backlog に残し、まとまった機能は通常の Phase 仕様確定議事録で扱う
