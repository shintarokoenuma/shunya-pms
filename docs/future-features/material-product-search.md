# 素材 → 品番検索（BOM 経由）の業務シナリオと設計案

**作成日**：2026-05-27
**作成者**：Shin（肥沼慎太郎）+ Claude
**ステータス**：構想段階（Phase 1A-13 + Phase 1B 着手時に詳細設計）
**起点**：Phase 1A-10 仕様確定議論（全体設計議論、経理 / 入力業務の観点）

---

## 1. 業務シナリオ

### シナリオ 1：素材から品番を逆引き

> 「このボタン M-BTN-0042 はどの品番に使われているか？」

- 経理：仕入れたボタンが「どの案件のものか」分からず、原価集計時に困る
- 生産管理：「この素材の在庫が切れそう、影響する品番は？」を即答したい
- 営業：「この素材は次のシーズンも使う？」を BOM 履歴から判断したい

### シナリオ 2：仕入先から納品案件を逆引き

> 「Supplier X から仕入れたファスナー在庫は、どの案件に紐づいているか？」

- 経理：仕入先 X の請求書を見て、どの WO / 案件に按分するか判断
- 在庫管理：「Supplier X の素材を消費した実績一覧」を確認

### シナリオ 3：仕入先 → 素材 → 品番の経路

> 「ボタン Supplier Y のラインナップで、現在生産中の品番に使われているもの」

- 営業：仕入先との取引拡大検討時の参考データ
- 生産管理：仕入先 Y の素材の使用状況を可視化

## 2. データパスの整理

```
Material（素材マスター）
   ↓ BomItem（資材表の行：素材 × 数量）
   ↓ Bom（資材表）
   ↓ Product（品番）
   ↓ Brand / ModelCode
```

「素材 → 品番」は **BOM 経由** でつながる。Phase 1B（BOM 実装）が完了して初めて実用可能。

## 3. Phase 別の状況

| Phase | 状況 | 検索可能か |
|---|---|---|
| Phase 1A-13（Material マスター単体）| 素材の基本情報のみ | ❌「使用品番」は表示不可（まだ BOM データなし）|
| Phase 1B（BOM 実装後）| BOM が品番ごとに作られる | ✅「素材 X を使う品番」が引ける |
| Phase 1C（在庫実装後）| 在庫ロット × 出庫履歴が蓄積 | ✅「Supplier X 仕入の在庫がどの案件で消費されたか」が引ける |

## 4. 設計案

### 4.1 Phase 1A-13（Material マスター実装）でやること

#### 「使用品番」セクションのプレースホルダ予約

Material 詳細ページに、以下のセクションを **プレースホルダで予約**する：

```
┌─ 素材詳細：M-BTN-0042 ─────────────────────┐
│  基本情報、HS コード、原産国、組成 など    │
├─ 使用品番一覧（Phase 1B 完成後に有効）────┤
│  ※ BOM が実装されるとここに表示されます    │
│  ※ 現在は BOM データが存在しないため空表示 │
└────────────────────────────────────────────┘
```

これは Phase 1A-10 の DD で「Phase 1A-10 完成時にここに DD 一覧が出る」とコメント予約したのと同じパターン。

#### Supplier FK の設計

Material は仕入先と紐付くが、紐付け方を確定する必要あり：

**案 A：単一 Supplier FK（必須）**

```prisma
model Material {
  supplierId String @map("supplier_id")
  // ...
}
```

- メリット：シンプル、Supplier 別の素材一覧が即座に引ける
- デメリット：同じ素材を複数 Supplier から仕入れるケースに対応できない

**案 B：複数 Supplier の N:N（中間テーブル）**

```prisma
model MaterialSupplier {
  materialId String @map("material_id")
  supplierId String @map("supplier_id")
  isPrimary  Boolean @default(false)
  unitPrice  Decimal? @db.Decimal(15, 4)  // 仕入先別の参考単価
  // ...
}
```

- メリット：実態に合う（同じ生地を複数 Supplier から仕入れるケースあり）
- デメリット：マスター登録時の運用負荷増

**推奨**：**案 A（単一 Supplier FK）を Phase 1A-13 で採用、Phase 1B 以降に必要なら案 B へ拡張**

### 4.2 Phase 1B（BOM 実装）でやること

#### BOM スキーマ実装

```prisma
model Bom {
  id        String @id @default(uuid())
  productId String @map("product_id")
  version   Int    @default(1)
  // ...
  items BomItem[]
}

model BomItem {
  id         String @id @default(uuid())
  bomId      String @map("bom_id")
  materialId String @map("material_id")
  quantity   Decimal @db.Decimal(15, 4)
  unit       String @db.VarChar(20)
  // ...
  bom      Bom      @relation(fields: [bomId], references: [id])
  material Material @relation(fields: [materialId], references: [id])
}
```

#### Material 詳細「使用品番一覧」セクションの有効化

```typescript
async function getMaterialUsageInProducts(materialId: string) {
  return await prisma.product.findMany({
    where: {
      boms: {
        some: {
          items: {
            some: { materialId }
          }
        }
      }
    },
    include: { brand: true, modelCode: true }
  })
}
```

UI 表示例：

```
┌─ 素材詳細：M-BTN-0042 ─────────────────────┐
│  ...                                       │
├─ 使用品番（5 件）─────────────────────────┤
│  MK-26SS-TS-001  ALPHA  T シャツ         │
│  MK-26SS-TS-002  ALPHA  ロングT          │
│  MK-26FW-JKT-001 BETA   ジャケット       │
│  ...                                       │
├─ Supplier 仕入実績（Phase 1C 完成後）─────┤
│  ※ 在庫が実装されるとここに表示されます    │
└────────────────────────────────────────────┘
```

### 4.3 Phase 1C（在庫実装）でやること

#### 在庫 + 出庫履歴から「Supplier X の素材消費先」を算出

```sql
SELECT DISTINCT p.id, p.product_code, p.brand_id
FROM materials m
JOIN inventory_lots il ON il.material_id = m.id
JOIN inventory_movements im ON im.lot_id = il.id
JOIN work_orders wo ON wo.id = im.work_order_id  -- 出庫先
JOIN products p ON p.id = wo.product_id
WHERE m.supplier_id = ?  -- Supplier X
  AND im.movement_type = 'OUT'
```

これで「Supplier X の素材を使った品番一覧」が動的に引ける。

## 5. Phase 1A-13 仕様確定議論で重視すべきこと

Phase 1A-13（Material マスター）の仕様確定議論時に、以下を論点化：

1. **Supplier FK は単一 or 複数**：上記 4.1 の案 A / B どちらを採用するか
2. **「使用品番」プレースホルダの予約**：Phase 1B での有効化を見越したコメント / UI
3. **categoryCode の親子構造**：ProductCategory パターンの流用
4. **HS コード / 原産国 / 組成**：貿易データの扱い
5. **画像添付**：素材の現物写真を Material マスターに紐付けるか

## 6. 関連ドキュメント

- `docs/phase1a-10-spec-confirmation-2026-05-27.md`：本構想の起点議論
- `docs/shunya-master-patterns.md` v1.2：実装パターン集
- `docs/future-features/brand-buyer-relationship.md`：類似の「実績ベース vs 明示的リレーション」議論
- 仕様書 Part 2：BOM データ構造の原設計
- 仕様書 Part 3：5.2 在庫管理（在庫評価、原価計算）

---

**判断時期**：

- Phase 1A-13 着手時：Supplier FK 設計、プレースホルダ予約
- Phase 1B 着手時：BOM スキーマ、Material 詳細での「使用品番」セクション有効化
- Phase 1C 着手時：在庫 + 出庫履歴経由のクエリ
