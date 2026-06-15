# 製品概要1ページ構想 仕様確認書 v0.4 — B-062 β データモデル確定（2026-06-15 セッション4）

- ステータス: 設計確定（コード変更なし）。§5 全確定。
- ベース: v0.1（要件・5要素・付属マトリクス列・色二層モデルが正）/ v0.2（決定1-5）。本書は B-062 β のデータモデルを live grep 確定事実の上に条文化する。
- 根拠（記憶でなく読み直し）: v0.1 §2/§4・v0.2 決定2/3/4・color-master 仕様確認書(2026-06-01)・本セッション live grep（schema 実体）。

## 0. live grep による前提アップデート（v0.2 の未確認点の解消）
| v0.2/v0.1 の注記 | live grep 後の確定 |
|---|---|
| 決定2「specificationId NOT NULL かも」 | 既に String?（QE-0a で緩和済み）→ ③ は migration 不要 |
| 決定4-(i)「色マスター未 build なら build 内包」 | Color は CRUD フル build 済み（8 export）→ build 不要・B-063 大幅減量 |
| 決定4 改訂2「colorNameEn 実装形」 | Color に EN 列なし → 新規列 migration 確定（B-063 で実施） |
| 決定4 改訂1「availableColors の形」 | 現状 [{name,code,hex}]・未適用（JSON ゆえ migration 不要・B-063） |
| §4「最大の穴＝カラーウェイ軸なし」 | ProductColorway + BomItemColorway の2テーブルで解消 |
| Colorway エンティティ | schema にゼロ（確定）→ 新設が β の本体 |

## 1. β の確定事項
- 1-1. カラーウェイの実体 = ProductColorway を新設。SKU の親。SKU 非依存で品番カルテに色展開を定義でき、北極星を SKU 生成導線（別タスク）に縛らせない。将来 Sku.colorwayId で FK 合流（B-063 ④）。
- 1-2. 資材×カラーウェイの調達カラー(C/#) = BomItemColorway 子テーブル。v0.1 §2「C/# のみカラーウェイ別」を担う。BomItem 本体は左3列ベース（supplierItemCode / sizeValue+sizeUnit / usagePerUnit+unit）を既存のまま使う。
- 1-3. 既存 BomItem 単色列（colorCode/colorName/pantone）は deprecate せず併存。BomItemColorway を持たない資材＝全カラーウェイ共通（芯地等・f24-so08 で C/# が色によらない資材）の色指定として残す。「色変動品は BomItemColorway／全色共通品は本体の単色列」の二段構え。
- 1-4. 色マスター連携（colorId 配線・色名のマスター解決）は β に含めず B-063 へ後送り。ただし migration を増やさないため ProductColorway に colorId? 列は β 時点で作っておき、配線（FK 化・色名解決）だけ B-063 で行う（列の存在 ≠ 連携ロジック）。β 段階の色名は ProductColorway.colorwayName の値持ちで足りる。
- 1-5. ③（BOM Product 直結を正系に）は schema 変更ゼロ（specificationId 既に nullable）。規約・バリデータレベルの整理に留め、β の migration には含めない。

## 2. データモデル（Prisma 確定形）
```prisma
/// 製品のカラー展開（カラーウェイ）。品番カルテのカラー軸の親。SKU 非依存。
model ProductColorway {
  id        String @id @default(uuid())
  companyId String @map("company_id")
  productId String @map("product_id")

  colorwayCode String @map("colorway_code") @db.VarChar(50)  // A / BLK 等
  colorwayName String @map("colorway_name") @db.VarChar(100) // ブラック 等

  colorId  String? @map("color_id")  // Color マスター scalar FK（@relation なし）。β では未配線・B-063 で配線
  colorHex String? @map("color_hex") @db.VarChar(7)

  sortOrder Int    @default(0) @map("sort_order")
  status    String @default("ACTIVE") @db.VarChar(20)

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  product       Product           @relation(fields: [productId], references: [id], onDelete: Cascade)
  bomItemColors BomItemColorway[]

  @@unique([productId, colorwayCode])
  @@index([companyId, productId])
  @@map("product_colorways")
}

/// 資材×カラーウェイの調達カラー（先方 C/#）。v0.1 §2「C/# のみカラーウェイ別」を担う。
model BomItemColorway {
  id                String @id @default(uuid())
  bomItemId         String @map("bom_item_id")
  productColorwayId String @map("product_colorway_id")

  supplierColorCode String  @map("supplier_color_code") @db.VarChar(100) // 先方 C/#（結合キー）
  supplierColorName String? @map("supplier_color_name") @db.VarChar(100) // 任意

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  bomItem         BomItem         @relation(fields: [bomItemId], references: [id], onDelete: Cascade)
  productColorway ProductColorway @relation(fields: [productColorwayId], references: [id], onDelete: Cascade)

  @@unique([bomItemId, productColorwayId])
  @@index([productColorwayId])
  @@map("bom_item_colorways")
}
```
- 逆リレーション2行を追加: Product.colorways ProductColorway[] / BomItem.colorways BomItemColorway[]。
- colorId / colorHex を scalar FK（@relation なし）にしたのは markingRecordId / purchaseOrderId と同じ house style に合わせるため。

## 3. migration 方針
- β = 新規2テーブル ADD 1本のみ（決定3「migration を2回に割らない」と整合。③ が schema 変更ゼロのため別 migration 不要）。
- 既存列の変更・削除なし＝既存データ非破壊（ADD TABLE のみ）。
- 本番反映は三重ガード対象: host 確認(shuttle:16099) → dev で db push 検証 → 本番 migrate deploy（デプロイログで Applying migration 目視）。
- dev=db push / prod=migrate deploy の二系統を踏襲。

## 4. スコープ境界
- β（B-062）に含む: ProductColorway CRUD・BomItemColorway 編集（付属マトリクスのカラーウェイ列）・品番カルテへの付属マトリクス描画。
- B-063 に送る: Color FK 化（ProductColorway.colorId / Sku 色）・availableColors 改訂1・colorNameEn migration・帳票色名解決・初期50色データ投入。
- B-064（完了）: 数量マトリクス（Sku 色×サイズ）描画。β のカラーウェイ列と将来 colorwayId で接続。

## 5. 確定事項（§5 全確定・2026-06-15）
1. 1-3 の併存設計（単色品は本体列・色変動品は BomItemColorway）で確定。破壊ゼロ・芯地等の全色共通資材を素直に表現できる。
2. ProductColorway のフィールド粒度は colorwayCode/colorwayName/colorId?/colorHex?/sortOrder で確定。カラーウェイ略号（f24-so08 の A/B）は colorwayCode で兼ねる。
3. β UI は ProductColorway 管理を先行で確定。カラーウェイが無いと BomItemColorway の列が作れない依存順のため、まず色展開を定義できる状態を作り、C/# マトリクス入力は次 PR。

## 6. 次のステップ
1. （完了）§5 確定。
2. （本書）v0.4 を docs/specs/ に保存。
3. β 実装ブリーフ化（schema 追記＋手書き migration＝本番スキーマ変更＝三重ガード）。ProductColorway 管理を先行 PR、BomItemColorway×C/# マトリクス入力を次 PR。
