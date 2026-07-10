# B-015 実装指示書（Claude Code 向け）— Material UPDATE 監査スナップショット残漏れ補完

- 作成日: 2026-06-03 / Claude.ai
- 対象: **B-015**（Material UPDATE の auditLog に記録されない業務フィールドの補完・優先度 中。価格系=unitPrice/currency/unit は履歴として優先度高め）
- 前提チケット: **B-006**（PR #55 で categoryId のみ補完済み）の残作業。B-006 STEP2 で「他の漏れは所見として記録（別バックログ起票候補）」とした受け皿が本チケット。
- 参照: `shunya-master-patterns.md`、`b-006-b-010-implementation-brief-2026-06-02.md`、`updateColor`/`updateSupplier` 等の兄弟 update action
- 採用方針: **案1-a**（欠落フィールド補完 ＋ 型による列挙漏れ検知の保険）。案2（全マスター横断の監査自動化）は不採用＝将来の別チケット。
- 性格: **code-only のバグ修正（schema 変更なし＝migration なし＝本番DB無風）**。検証は **dev（`7492` / `hopper`）のみ**。**本番 seed・本番操作は本指示書のスコープ外**。

---

## 共通の前提（着手前）

- `git checkout main && git pull origin main` で最新を取り込む。ローカルは main 1本・クリーンであること（前回 HEAD 2384eb8 以降の更新を取得）。
- TypeScript はファイル保存（**ターミナル直貼り禁止**）。**main 直コミット禁止**。feature ブランチ → PR → squash merge（`shunya-git-workflow`：コードを含むので PR 必須）。
- dev 作業前に `railway run printenv DATABASE_URL | sed -E 's|.*@([^/]+)/.*|HOST=\1|'` で **dev（`7492` / `hopper`）** であることを確認（safety-check）。
- 本番 DB への seed/CRUD は **本指示書では行わない**。
- Co-Authored-By は現行のモデル表記に揃える。

ブランチ: `fix/material-update-audit-snapshot`（PR #57 想定）

---

## STEP 1: 調査（着手前・必須・まず報告）

修正に入る前に、以下を読んで **現状の監査スナップショットが Material のどの業務フィールドを記録しているか** を確定し、欠落リストを報告すること。

読む対象:
- `src/lib/actions/materials.ts` の `updateMaterial`（更新本体と auditLog 書き込み箇所。B-006 で categoryId を足した後の現状）
- 監査の共通ヘルパー（`createAuditLog` / `writeAuditLog` 等。`src/lib/` 配下）
- 兄弟 update action の **スナップショットの取り方の流儀**:
  - `updateColor`（`src/lib/actions/colors.ts`）
  - `updateSupplier`（`src/lib/actions/suppliers.ts`）— 連絡先付き重厚マスター
  - 可能なら `updateMaterialCategory` も

### 1-1. 欠落フィールドの確定

`Material` の業務フィールド（schema 由来・全26項目）と、現状スナップショットに含まれるフィールドを突き合わせ、**欠落リスト**を作る。

監査対象＝**システム項目を除く全業務フィールド**。除外するシステム項目は次の5つのみ:
`id` / `companyId` / `createdAt` / `updatedAt` / `deletedAt`

監査対象になる業務フィールド（参考・確定は実コードとの突き合わせで）:

```
materialCode, materialName, materialNameEn, materialNameZh, materialNameVi,
categoryId(B-006で記録済), materialType,
primarySupplierId,
specification,
fabricWeight, fabricWidth, composition, compositionData(Json),
standardUsage, standardLossRate,
unitPrice, currency, unit,            ← 価格履歴・最優先
minimumOrderQty,
hsCode, originCountry,
availableColors(Json),
imageUrl, swatchImageUrl,
notes,
status                                 ← 1-2 の確認結果に従う
```

### 1-2. status の二重記録チェック（重要）

`updateMaterial` が `status` を更新経路に持つか確認する。`archiveMaterial`/`restoreMaterial` が status 変更を別途 auditLog（ARCHIVE/RESTORE 相当）に記録している場合、`updateMaterial` のスナップショットに status を含めても **二重記録にはならない**（update と archive は別操作・別ログ）。ただし、`updateMaterial` 内に「status だけはここでは扱わない」という既存の意図がある場合はそれを尊重する。判定結果を報告すること。

### 報告フォーマット
```
現状スナップショット記録フィールド = [ ... ]
欠落フィールド = [ ... ]（n 件）
兄弟 action の流儀 = 手書き列挙 / エンティティ丸ごと / その他（引用付き）
status の扱い = 含める / 除外（理由）
```

---

## STEP 2: 修正方針（案1-a）

**ゴール**:
1. 既存 Material を編集してどの業務フィールドを変更しても、`beforeData`/`afterData` に旧値・新値が漏れなく入る。
2. **将来 Material に業務フィールドを追加したとき、スナップショットへの追加を忘れるとコンパイルエラーになる**（B-006 の再発防止＝案1-a の主目的）。

### 2-1. 欠落フィールドの補完

STEP1 で確定した欠落フィールドを、`beforeData` と `afterData` の **両方** に追加する。

- categoryId は B-006 で追加済み・維持する。
- Json フィールド（compositionData, availableColors）も含める。
- status は 1-2 の確認結果に従う。
- 監査書き込みは更新と **同一 `$transaction` 内**（B-006 と同じ原子性。archive/restore のトランザクション外パターンには寄せない）。

### 2-2. 型による列挙漏れ検知（案1-a の保険・本チケットの肝）

スナップショットを組む箇所に、**全監査対象キーの網羅を型で強制**する。

**第一推奨（Prisma 生成型ベース・列挙漏れを自動検知）**:

```typescript
// Prisma が生成する MaterialScalarFieldEnum をベースに、
// システム項目だけを Exclude して「監査対象キー」型を定義する。
// → schema にスカラを足すと MaterialScalarFieldEnum に自動で増えるため、
//   Exclude しない限りこの型に自動で含まれ、スナップショットへの追加漏れがコンパイルエラーになる。
type MaterialAuditField = Exclude<
  keyof typeof Prisma.MaterialScalarFieldEnum,
  'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>

// before / after の両方に satisfies で全キー網羅を要求する
const beforeData = {
  materialCode: before.materialCode,
  materialName: before.materialName,
  // … 全フィールド …
  status: before.status,
} satisfies Record<MaterialAuditField, unknown>

const afterData = {
  materialCode: updated.materialCode,
  // … 全フィールド …
  status: updated.status,
} satisfies Record<MaterialAuditField, unknown>
```

- `satisfies Record<MaterialAuditField, unknown>` により、キーが1つでも欠けると **コンパイルエラー**になる（＝列挙漏れ検知）。
- `unknown` を使うのは、値の型（Decimal/Json/enum 等）を緩く受けるため。実行時の値はそのまま。
- 実行時の挙動は変わらない（保険は型レベルのみ）。

**代替（第一推奨が困難な場合のみ）**:
`as const` 配列で監査対象キーを1か所に定義し、それを `keyof` 検査と組み合わせる方式でも可。ただし「schema 追加時に自動で型が気づく」性質は Prisma 生成型ベースの方が強いので、まず第一推奨を試すこと。

### 2-3. 制約（スコープを広げない）

- 変更してよいのは **`updateMaterial`** と、必要なら **その近傍の型定義/監査ヘルパーの呼び出し箇所のみ**。
- **広域リファクタ禁止**。共通監査ヘルパーのシグネチャを全マスター向けに作り替える等は **案2＝本チケット対象外**。
- **他マスター（Supplier/Factory/Contractor/Buyer/Client/Brand 等）には触らない**。同種の漏れを見つけても、本 PR では Material のみ修正し、他は STEP4 の所見に回す。
- 既存の `setState-in-effect` 等の lint は触らない（既存パターン・別チケット）。

---

## STEP 3: 検証（dev のみ）

dev（`7492` / `hopper`）で実施。`printenv DATABASE_URL` で host 確認（safety-check）。

1. テスト用 Material を1件用意（無ければ作成）。
2. **(a) 価格系（unitPrice）だけ変更** → AuditLog に UPDATE 1件、`beforeData.unitPrice`=旧 / `afterData.unitPrice`=新。
3. **(b) 複数フィールド同時変更**（例: unitPrice + currency + composition + fabricWidth）→ before/after に全変更が反映。
4. **(c) categoryId だけ変更**（B-006 回帰確認）→ 引き続き旧/新が記録される。
5. **(d) Json フィールド変更**（availableColors）→ before/after に記録される。
6. **(e) 型保険の動作確認**（任意・できれば）: スナップショットからキーを1つ意図的に削ると `npx tsc --noEmit` がエラーになることを確認 → 確認後に元に戻す。
7. `npx tsc --noEmit` clean。

---

## STEP 4: 所見記録（横展開の判断材料・PRには含めない）

- 他マスターの update action（Supplier/Factory/Contractor/Buyer/Client/Brand/MaterialCategory 等）が、同じ「手書きスナップショット＋網羅強制なし」方式で同種の監査漏れを抱えていそうか、**ざっと目視**して所見だけ報告する（修正はしない）。
- 所見は慎太郎さん経由で Claude.ai に共有 → 横断根治（案2 相当）を別チケット起票するかの判断材料にする。
- PR #56 で seed afterData に付けた `seedScript` キーの準拠形整合（引き継ぎメモ §⑤ の未確認事項）も、この監査整理のついでに気づけば所見へ。

---

## スコープ外（B-015）

- schema 変更・migration。
- 本番 seed / 本番操作。
- 他マスターの同種漏れの **修正**（所見のみ）。
- 案2（全マスター横断の監査スナップショット自動化／共通ヘルパー化）。

---

## 実施順

1. STEP1 調査 → 欠落リストと status 判定を報告。
2. STEP2（案1-a）で補完＋型保険を実装。
3. STEP3 を dev で検証、`tsc --noEmit` clean。
4. PR #57 作成 → squash merge。
5. STEP4 の所見を残す（PR とは別。docs かチャット報告）。
