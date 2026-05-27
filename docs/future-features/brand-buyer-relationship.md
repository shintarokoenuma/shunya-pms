# Brand ↔ Buyer / DD のリレーション設計案

**作成日**：2026-05-27
**作成者**：Shin（肥沼慎太郎）+ Claude
**ステータス**：構想段階（Phase 1B 着手時に正式判断）
**起点**：Phase 1A-10 仕様確定議論（D-2）+ 4 階層モデル整理

---

## 1. 課題

shunya のデータモデルは Phase 1A-11 で 4 階層構造として確定済み：

```
Client（会社）
   ├─ Brand[]   （所有ブランド群、商品 identity）
   └─ Buyer[]  → DD[]  （発注主体・物理拠点）
```

しかし、`Brand` と `Buyer` / `DD` の間に **直接の紐付けがない**。

```
Client
  ├─ Brand: ALPHA、BETA
  └─ Buyer: BEAMS、Tomorrowland
        ↓
        DD: BEAMS渋谷店、原宿店、...
```

→ 「**ALPHA Brand を扱う Buyer / DD はどれか**」が DB から直接引けない。

## 2. 業務シナリオでの必要性

### 営業視点

- 「ALPHA の卸先候補一覧」を絞り込みたい
- 「Buyer X が現在扱っている Brand」を確認したい
- 商談時に「この Buyer はどの Brand を受け入れ可能か」を即答したい

### 生産管理視点

- 「ALPHA の出荷先一覧」を確認したい
- 「ALPHA を生産している過程の Buyer / DD 状況」を俯瞰したい

### 経理視点

- 直接の影響は薄い（請求は Client 単位、Brand 別の集計は分析機能で対応）

## 3. 設計案 3 つ

### 案 A：明示的 N:N リレーション

Brand と Buyer / DD に明示的な中間テーブルを追加：

```prisma
model BrandBuyer {
  brandId   String @map("brand_id")
  buyerId   String @map("buyer_id")
  createdAt DateTime @default(now()) @map("created_at")
  
  brand Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)
  buyer Buyer @relation(fields: [buyerId], references: [id], onDelete: Cascade)
  
  @@id([brandId, buyerId])
  @@map("brand_buyers")
}

model BrandDeliveryDestination {
  brandId       String @map("brand_id")
  destinationId String @map("destination_id")
  createdAt     DateTime @default(now()) @map("created_at")
  
  brand       Brand               @relation(fields: [brandId], references: [id], onDelete: Cascade)
  destination DeliveryDestination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  
  @@id([brandId, destinationId])
  @@map("brand_delivery_destinations")
}
```

**メリット**：

- Brand と Buyer / DD の関係が明示的にデータ化される
- 検索性が完璧（join 1 段）
- 「ALPHA の取引可能 Buyer」「BEAMS-DOM が扱う Brand」が即座に引ける

**デメリット**：

- 登録運用の負荷増：Buyer / DD 作成時に「どの Brand を扱うか」を毎回選ぶ必要
- データの真実性の管理：実態と一致しない紐付けが残るリスク（「ALPHA は BEAMS で扱える」と登録していたが実態では商談していない、等）
- マスターメンテナンスのコスト

### 案 B：業務トランザクション経由の動的算出

業務トランザクション（PO / SO / DLV / Invoice）の実績から動的に算出。

```sql
-- 「ALPHA を扱う Buyer 一覧」（過去 1 年実績）
SELECT DISTINCT b.id, b.buyer_code, b.buyer_name
FROM brands br
JOIN products p ON p.brand_id = br.id
JOIN sales_orders so ON so.product_id = p.id
JOIN buyers b ON b.id = so.buyer_id
WHERE br.id = ? -- ALPHA の brand_id
  AND so.created_at > NOW() - INTERVAL '1 year'
```

**メリット**：

- 実態ベースなので「実際に扱われている」関係のみが見える
- マスター登録時の負荷ゼロ
- データの真実性が保証される（取引実績がある = 確かに扱っている）

**デメリット**：

- 取引実績がないと検索できない（新規 Brand / 新規 Buyer 組み合わせは見つからない）
- 受注ベースなので「商談中だが受注前」の関係は捕捉できない
- 集計クエリのコスト（大量データ時のパフォーマンス）

### 案 C：ハイブリッド（案 A + 案 B）

明示的な中間テーブル + 業務トランザクション実績の両方を活用：

- マスター登録時に「取引候補 Brand」を任意で指定（案 A）
- 受注実績がある関係を「実績 Brand」として併用表示（案 B）
- 検索 UI で「候補」「実績」の両方を見せる

**メリット**：

- 新規関係（候補）と既存関係（実績）の両方を扱える
- マスター登録は任意なので運用負荷をコントロール可能

**デメリット**：

- 設計複雑度が増す
- UI も「候補」と「実績」を区別する必要がある

## 4. 推奨：案 B（業務トランザクション経由）を Phase 1B 着手時にデフォルト採用

### 理由

1. **業務感覚に合う**：「実際に取引している関係」を表示する方が運用ミスがない
2. **マスター登録の負荷ゼロ**：Buyer / DD 作成時に Brand 選択を強制しない
3. **データの真実性が担保される**：実態と乖離した紐付けが残らない
4. **Phase 1B（業務トランザクション実装）でのデータ蓄積を待てる**：Phase 1A 時点では業務トランザクションが存在しないので案 A しか実装できないが、Phase 1B 完了後は案 B が自然に使える

### 案 A を採用する条件

以下のいずれかが満たされる場合は案 A（明示的 N:N）に切り替え：

- 業務上「商談中の関係」を可視化する強い要求が出てきた
- 案 B で「受注実績がない Brand-Buyer 候補」を扱えないことが運用上のボトルネックになった
- 営業ダッシュボードで「取引可能 Brand 候補」表示が必要になった（Phase 2 領域）

## 5. 実装タイミング

| Phase | 状況 |
|---|---|
| Phase 1A | **何もしない**（業務トランザクションがまだないため案 B も実装不可、案 A は登録運用が確立されていない）|
| Phase 1B | 業務トランザクション（PO / SO / DLV / Invoice）実装時に案 B クエリを設計・実装 |
| Phase 1B 完了後 | 営業 UI / 生産管理 UI で案 B のクエリを使った「実績ベース Brand 一覧」「Brand 別 Buyer 一覧」を提供 |
| Phase 2 以降 | 案 B の運用で不足が出てきたら案 A or 案 C に切り替え検討 |

## 6. Phase 1A 期間の暫定対応

- DD の一覧フィルタは Client / Buyer / Status の 3 つのみ（Phase 1A-10 確定済み）
- Brand 単体フィルタは追加しない
- 「ALPHA の納品先」を見たいユーザーは Client 経由で間接的に到達（Client = MARKA → 配下 DD 一覧）

## 7. 関連ドキュメント

- `docs/phase1a-10-spec-confirmation-2026-05-27.md`：Phase 1A-10 議事録（D-2 議論）
- `docs/phase1a-11-spec-confirmation-2026-05-25.md`：Phase 1A-11 議事録（4 階層モデル確定）
- `docs/shunya-master-patterns.md` v1.2：実装パターン集

---

**判断時期**：Phase 1B 着手時。業務トランザクション設計と同時に詰める。
