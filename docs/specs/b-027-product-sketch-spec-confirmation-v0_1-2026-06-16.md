# 仕様確認議事録 — B-027 品番カルテ「絵型（服のスケッチ）」（v0.1 ドラフト）

- 作成日: 2026-06-16 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v0.1（ドラフト・論点整理版）**
- ステータス: **レビュー待ち**（§8 の論点を確定して v1.0 にする）
- 位置づけ: 北極星「品番カルテ（一品番一枚完結ビュー）」5要素の最後＝**服のスケッチ**を品番カルテに載せる。
- 採用方針: **(B) Product 直接フィールド追加・複数枚 Json 配列**（慎太郎さん確定済み）。

---

## 0. このドキュメントの読み方

- 「✓ 確定」= 慎太郎さんと合意済み。
- 「△ 論点」= 未確定。選択肢と私（Claude）の推奨を併記。**慎太郎さんの判断で確定する。**
- 本書は 2026-06-16 の read-only 調査（schema / gcs.ts / markings.ts / products.ts / page.tsx 実測）に基づく。記憶ではなくコードの真値で書いている。
- schema 変更（migration）を伴うため、着手時は dev/本番の環境安全確認（safety-check）を全面適用する。

---

## 1. 北極星における位置づけ（✓ 確定）

- 北極星5要素 = 製品コード／カラー×サイズ数量マトリクス／カラーラインナップ／付属マトリクス／**服のスケッチ**。
- 既に実装済み: 製品コード（S-1）・数量マトリクス（B-064 #82）・カラー展開（B-062 β #83/#84）・資材表 BOM（QE-0b）。
- **本タスク B-027 = 最後の「服のスケッチ」。これを載せれば北極星5要素が揃う。**

---

## 2. 設計フォークの結論（✓ 確定）

絵型の持ち場所として2案を検討し、**(B) を採用**した。

- **(A) DesignVersion を正に使う案**（不採用）: 既存 `DesignVersion.flatSketchFrontUrl/BackUrl` を使う。三位一体（デザイン/仕様/パターンのバージョン同期・仕様書5.8）に正面から乗るが、`version`/`versionNumber`/`baseVersionId`/`@@unique([modelCodeId, version])` のバージョン体系を最初から扱う必要があり、DesignVersion の CRUD/UI も未実装。北極星を閉じるには過剰。
- **(B) Product に直接フィールド追加案**（採用）: `Product` に絵型用フィールドを1つ足す。migration は ADD COLUMN 1本（非破壊）。markings の実証済みアップロード経路を鏡写しできて最短。

### 2-1. DesignVersion.flatSketch との関係（✓ 確定）

- 本タスクの絵型は **「品番カルテ用のスナップ画像」レイヤー**。`DesignVersion` のフラットスケッチ（デザイン成果物のバージョン管理レイヤー）とは**別物**として共存させる。
- これは色の2層モデル（仕入先カラー文字列 vs Color マスター）と同じ考え方。**軽量・即時のスナップ層**と**重量・後続のデザイン版管理層**を分ける。
- 将来、三位一体のデザイン版管理が本格化したら、`DesignVersion` 側を正規の絵型ソースとし、Product 側はそのサムネ表示に切り替える発展が可能（本タスクのスコープ外・帳票/マルチペルソナフェーズ）。

---

## 3. データモデル（△ 論点 §8-2 で最終確定／本書の推奨形）

`Product` に**複数枚 Json 配列**で絵型を持つ（慎太郎さん選択）。既存の `SampleProduction.photoUrls Json?` / `Inspection.photoUrls Json?` と同じ「画像を Json 配列で持つ」既存前例に揃える。

```prisma
model Product {
  // ... 既存フィールド ...

  // B-027: 品番カルテ用 絵型（服のスケッチ）スナップ画像。
  // DesignVersion.flatSketch とは別レイヤー（§2-1）。GCS パスを保持し表示時に署名URL化。
  sketchImages  Json?  @map("sketch_images")
  // 形: [{ gcsPath: "sketch/<productId>/<JST>.<ext>", caption?: string, sortOrder: number }]
}
```

- 保存するのは **GCS パス（`gs://bucket/object`）**。署名URL は表示時に都度発行（markings の `originalFileGcsPath` と同パターン。バケットは非公開）。
- `caption`（任意）で「前／後／ディテール」等のラベル付け。`sortOrder` で並び順保持。
- migration: `ALTER TABLE products ADD COLUMN sketch_images jsonb`（**1本・非破壊・既存データ不変**）。本番 colors 等の既存データに一切触れない。migration 33本目（現 32本）。

> Json 配列の型安全: DB レベルでは jsonb なので、読み書きは validator（Zod）で形を保証する。`src/lib/types/product-sketch.ts`（prisma 非依存・中立型）に `ProductSketch` 型を定義し、client/server で共有（PR #85 の index-browser 罠回避）。

---

## 4. GCS アップロード基盤（✓ 確定・既存転用）

実測した既存基盤（`src/lib/gcs.ts`）を転用する。

- 環境変数: `GCP_PROJECT_ID` / `GCS_BUCKET_NAME` / `GCP_SERVICE_ACCOUNT_KEY_BASE64`。dev/prod はバケット名で出し分け（コード分岐なし）。
- graceful degradation: 未設定・失敗時は `console.error`（秘密情報を出さない）して `null` を返す。
- **既存 `uploadMarkingPdf` は contentType が `application/pdf` 固定**のため画像には流用不可。→ **画像用の関数を1本新設**する:

```ts
// src/lib/gcs.ts に追加
export async function uploadProductSketch(
  productId: string,
  buffer: Buffer,
  contentType: string,   // "image/png" | "image/jpeg" | "image/webp"
  ext: string,           // "png" | "jpg" | "webp"
): Promise<{ gcsPath: string } | null>
// パス規約: sketch/{productId}/{yyyyMMdd-HHmmss}.{ext}（履歴保持・上書きなし。timestampJst 流用）
```

- 閲覧URL生成は既存 `getSignedReadUrl(gcsPath)`（v4署名・15分）を**そのまま流用**。
- `next.config.ts`: `serverExternalPackages: ["@react-pdf/renderer","@google-cloud/storage"]` / `bodySizeLimit: "10mb"` は既存のままで足りる。

---

## 5. Server Actions（✓ 確定・markings 鏡写し）

`src/lib/actions/product-sketches.ts`（新規）に分離する（products.ts が肥大しているため）。`ActionResult<T>` は既存と同形。markings の `attachMarkingPdf` / `getMarkingPdfUrl` を鏡写し。

| 関数 | 役割 |
|---|---|
| `addProductSketch(productId, formData)` | 画像1枚を GCS アップロード → `sketchImages` 配列に追記 → AuditLog → revalidate |
| `deleteProductSketch(productId, gcsPath)` | `sketchImages` 配列から該当要素を除去（DB のみ・GCS は残置 §6）→ AuditLog → revalidate |
| `reorderProductSketches(productId, orderedPaths)` | `sortOrder` 振り直し（並び替え）→ revalidate |
| `getProductSketchUrls(productId)` | 配列各要素の gcsPath を署名URL化して返す（表示用・read のみ） |

検証（addProductSketch）:
- `formData.get("file")` が `File` か。
- `file.type` が許可形式（§8-3 で確定。推奨 `image/png` / `image/jpeg` / `image/webp`）。
- `file.size` が上限以下（§8-3 で確定。推奨 5MB。bodySizeLimit 10mb の範囲内）。
- 失敗時は **DB を変更せずエラー返却**（markings の「レコード変更していません」に倣う）。
- 全関数 `requireSession()` で auth + companyId スコープ。CREATE/UPDATE/DELETE は AuditLog 記録。

> 配列追記の同時実行: `sketchImages` は配列まるごと更新（last-write-wins）。同一品番に同時アップロードが走るケースは稀だが、`addProductSketch` 内で「最新を読み直してから追記」する（findFirst → 配列に push → update）。

---

## 6. 物理削除時の GCS 後始末（✓ 確定・既存方針に整合）

- 実測: `deleteProductPermanently` は 4重ガード（MASTER_ADMIN / ARCHIVED / 確認名一致 / 参照ゼロ）の後 `prisma.product.delete`。**GCS オブジェクトの後始末は無い**。markings の PDF も同様に GCS 残置（`gcs.ts` に delete 関数自体が無い）。
- **B-027 でも GCS 削除は実装しない**（孤児オブジェクト許容＝既存方針に整合）。`deleteProductSketch` も配列から外すだけで GCS は残す。
- 仕様書にこの方針を明記。将来 GCS のライフサイクル管理（孤児掃除）が要るなら別タスク（B-053 系の運用課題として申し送り）。

---

## 7. UI（△ 論点 §8-1 で配置確定／本書の推奨形）

- 新規 `src/app/(app)/products/_components/sketch-section.tsx`（client）。中立型 `src/lib/types/product-sketch.ts` から型 import。
- 構成: 複数画像のグリッド表示（`<img src={signedUrl}>`）＋各画像の削除ボタン＋並び替え＋「＋画像を追加」（`<input type="file" accept="image/*" hidden>` → FormData → `addProductSketch`）。markings の client パターン（`fd.set("file", file)` → server action 直叩き → `router.refresh()`）を踏襲。
- 署名URL は15分で失効するため、ページロード時に `getProductSketchUrls` で取得して表示（再訪時は再取得）。
- 配置（§8-1 で確定）: 現在の section 並びは 基本情報 → 品番分類 → シーズン → 数量納期 → ステータス履歴 → **カラー展開** → 数量マトリクス → サンプル製作 → 資材表BOM → マーキング実測 → メタ情報。絵型は「品番の見た目を最初に見せる」観点で **カラー展開の前**（or 基本情報の直後）が自然。

---

## 8. 未確定事項（要・慎太郎さん確認）

1. **絵型カードの配置位置（△）**: (a) 基本情報の直後＝最上部 / (b) カラー展開の前。推奨 = **(b) カラー展開の前**（見た目要素をまとめて上部に置く）。
2. **粒度の最終確認（△→ほぼ確定）**: 複数枚 Json 配列（慎太郎さん選択済み）。`caption`/`sortOrder` を持つ形（§3）でよいか。caption は不要（並び順だけ）なら簡素化する。
3. **許可形式・サイズ上限（△）**: 推奨 = `image/png` / `image/jpeg` / `image/webp`・**5MB 上限**。HEIC（iPhone 標準）を許可するか？（許可するならサーバ変換が要るので当面は非対応＝PNG/JPEG/WebP のみが楽）。
4. **サムネ生成（△）**: 仕様書6.5 には S/M/L サムネ自動生成の記述があるが、本タスクでは**原本1枚をそのまま表示**（サムネ生成・`sharp` 導入はしない）でよいか。推奨 = **しない**（北極星を最短で閉じる。サムネ最適化は要望が出たら別タスク）。
5. **枚数上限（△）**: 1品番あたりの絵型枚数に上限を設けるか。推奨 = **緩い上限（例 20枚）** をサーバ検証に入れる（暴発防止）。

---

## 9. スコープ境界（✓ 確定）

スコープ内:
- Product への `sketchImages` 追加（migration 1本）。
- 画像 GCS アップロード関数（`uploadProductSketch`）＋ Server Actions 4関数。
- 中立型 `product-sketch.ts`。
- `sketch-section.tsx` ＋ page.tsx への差し込み。

スコープ外（別タスク）:
- DesignVersion との統合・三位一体バージョン同期（帳票/マルチペルソナフェーズ）。
- サムネ自動生成（S/M/L）・画像圧縮・`sharp` 導入。
- GCS 孤児オブジェクトのライフサイクル管理（B-053 系運用課題）。
- 縫製仕様書PDF（B-054）への絵型差し込み（最終フェーズ）。
- HEIC 等のサーバ変換。

---

## 10. 次のステップ

1. 本書 §8 の論点（特に §8-1 配置 / §8-3 形式・上限）を確定 → v1.0。
2. v1.0 確定 → Claude Code 向け実装ブリーフ作成（migration 含む = 本番 DB スキーマ変更。着手前に dev リンク・migration 内容を safety-check）。
3. feature ブランチで実装 → 型/lint クリーン → PR open。
4. PR URL 3点セット（①ローカル localhost 確認 / ②マージ=本番反映 / ③本番確認）で進める。migration 入り PR なのでデプロイログの「Applying migration ...」行が ③ の本体。
