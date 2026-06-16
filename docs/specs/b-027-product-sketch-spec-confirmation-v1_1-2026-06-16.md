# 仕様確認議事録 — B-027 品番カルテ「絵型（服のスケッチ）」（v1.1 確定版）

- 作成日: 2026-06-16 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v1.1（確定・実装着手可能）**
- ステータス: **確定**
- 位置づけ: 北極星「品番カルテ（一品番一枚完結ビュー）」5要素の最後＝**服のスケッチ**を品番カルテに載せる。
- 採用方針: **(B) Product 直接フィールド追加・複数枚 Json 配列**（慎太郎さん確定済み）。
- v1.0 からの差分: **サーバ生成サムネ（sharp）を追加**。一覧表・進行状況確認表でサムネ確認したいという要件（慎太郎さん）を反映し、§4-2・§3・§5・§7 を更新。スコープは (P)＝詳細＋一覧サムネ＋取得 util まで（進行状況確認表は画面実装時に同 util を呼ぶ・本タスクは申し送り）。

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

## 3. データモデル（✓ 確定）

`Product` に**詳細用の複数枚 Json 配列**と、**一覧/進行表用の非正規化サムネパス**の2つを持つ。

```prisma
model Product {
  // ... 既存フィールド ...

  // B-027: 品番カルテ用 絵型（服のスケッチ）。DesignVersion.flatSketch とは別レイヤー（§2-1）。
  // 詳細ページ用・全枚数。各要素は原本パスとサムネパスの両方を持つ。GCS パス保持・表示時に署名URL化。
  sketchImages    Json?    @map("sketch_images")
  // 形: [{ gcsPath, thumbGcsPath, caption?, sortOrder }]
  //   gcsPath:      原本（最大5MB）の gs://...
  //   thumbGcsPath: サーバ生成サムネ（長辺400px・WebP）の gs://...

  // B-027: 一覧・進行状況確認表用に「先頭サムネ（sortOrder 最小）」のパスだけを非正規化して保持。
  // 一覧 select でこの1カラムだけ載せれば Json をパースせず軽い。
  // add/delete/reorder のたびに先頭サムネで同期する（絵型0枚なら null）。
  sketchThumbPath String?  @map("sketch_thumb_path") @db.VarChar(500)
}
```

設計意図:
- **2層に分ける**。`sketchImages`（詳細・重い・全枚数）と `sketchThumbPath`（一覧/進行表・軽い・1枚）。一覧の select に Json 全体を載せると行数ぶん重くなるため、先頭サムネのパスだけを非正規化カラムに持つ（「数を並べる画面」のための投資）。
- 保存するのは **GCS パス（`gs://bucket/object`）**。署名URL は表示時に都度発行（markings の `originalFileGcsPath` と同パターン。バケット非公開）。
- `caption`（任意）で「前／後／ディテール」等。`sortOrder` で並び順。**先頭 = sortOrder 最小**。
- migration: `ALTER TABLE products ADD COLUMN sketch_images jsonb, ADD COLUMN sketch_thumb_path varchar(500)`（**1本・非破壊・既存データ不変**）。本番 colors 等の既存データに一切触れない。migration 33本目（現 32本）。

> Json 配列の型安全: 読み書きは validator（Zod）で形を保証。`src/lib/types/product-sketch.ts`（prisma 非依存・中立型）に `ProductSketch` 型を定義し client/server 共有（PR #85 の index-browser 罠回避）。

---

## 4. GCS アップロード基盤（✓ 確定・既存転用）

実測した既存基盤（`src/lib/gcs.ts`）を転用する。

- 環境変数: `GCP_PROJECT_ID` / `GCS_BUCKET_NAME` / `GCP_SERVICE_ACCOUNT_KEY_BASE64`。dev/prod はバケット名で出し分け（コード分岐なし）。
- graceful degradation: 未設定・失敗時は `console.error`（秘密情報を出さない）して `null` を返す。
- **既存 `uploadMarkingPdf` は contentType が `application/pdf` 固定**のため画像には流用不可。→ **画像用の関数を新設**し、原本とサムネの2オブジェクトを保存する:

```ts
// src/lib/gcs.ts に追加
export async function uploadProductSketch(
  productId: string,
  originalBuffer: Buffer,
  thumbBuffer: Buffer,
  contentType: string,   // 原本の "image/png" | "image/jpeg" | "image/webp"
  ext: string,           // 原本の "png" | "jpg" | "webp"
): Promise<{ gcsPath: string; thumbGcsPath: string } | null>
// パス規約:
//   原本: sketch/{productId}/{yyyyMMdd-HHmmss}.{ext}
//   サムネ: sketch/{productId}/{yyyyMMdd-HHmmss}.thumb.webp（contentType "image/webp" 固定）
// 同一 stamp で原本・サムネを対にする。履歴保持・上書きなし。timestampJst 流用。
```

- 閲覧URL生成は既存 `getSignedReadUrl(gcsPath)`（v4署名・15分）を**そのまま流用**（原本・サムネ両方に使える）。

### 4-2. サムネ生成（sharp・✓ 確定）

- **`sharp` を依存追加**する。アップロード時にサーバ側（Server Action 内）で原本 buffer から**長辺400px・WebP のサムネ buffer** を生成し、原本とサムネの2つを GCS に保存する。
- 用途: 一覧表（品番カルテ一覧）・進行状況確認表で軽いサムネを並べるため。原本（最大5MB）を一覧の行数ぶんダウンロードすると重いため、サムネが本質的に必要。
- **`next.config.ts` の `serverExternalPackages` に `"sharp"` を追加**（ネイティブ依存をバンドルしない定石）。
- **ビルドリスク（実装時に必ず確認）**: sharp は linux-x64 のネイティブバイナリを要する。Railway の Linux ビルドで `npm install` が prebuilt を取得できるか、デプロイ前にローカル `npm run build` ＋ Railway デプロイログで実測確認する（記憶で「動く」と決めない）。万一ビルドで詰まったら、`sharp` を `optionalDependencies` ではなく通常依存にする／Node バージョンを `engines` で固定する等を検討。
- サムネ生成に失敗した場合は **原本だけ保存し thumbGcsPath は原本と同じにフォールバック**（サムネが無くても絵型表示は壊さない。graceful degradation の思想に合わせる）。

---

## 5. Server Actions（✓ 確定・markings 鏡写し）

`src/lib/actions/product-sketches.ts`（新規）に分離する（products.ts が肥大しているため）。`ActionResult<T>` は既存と同形。markings の `attachMarkingPdf` / `getMarkingPdfUrl` を鏡写し。

| 関数 | 役割 |
|---|---|
| `addProductSketch(productId, formData)` | 画像1枚を受け→ sharp でサムネ生成 → 原本＋サムネを GCS アップロード → `sketchImages` 配列に追記 → `sketchThumbPath` を先頭サムネで同期 → AuditLog → revalidate |
| `deleteProductSketch(productId, gcsPath)` | `sketchImages` から該当要素を除去（DB のみ・GCS は残置 §6）→ `sketchThumbPath` を新しい先頭で同期（0枚なら null）→ AuditLog → revalidate |
| `reorderProductSketches(productId, orderedPaths)` | `sortOrder` 振り直し → `sketchThumbPath` を新しい先頭で同期 → revalidate |
| `getProductSketchUrls(productId)` | 各要素の gcsPath・thumbGcsPath を署名URL化して返す（表示用・read のみ） |

検証（addProductSketch）:
- `formData.get("file")` が `File` か。
- `file.type` が許可形式（`image/png` / `image/jpeg` / `image/webp` の3形式）。
- `file.size` が **5MB 以下**（bodySizeLimit 10mb の範囲内）。
- 既存の `sketchImages` が **20枚未満**（上限ガード）。
- サムネ生成: `sharp(buffer).resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true }).webp().toBuffer()`。失敗時は原本のみ保存し thumbGcsPath=原本パスにフォールバック（§4-2）。
- 失敗時は **DB を変更せずエラー返却**（markings の「レコード変更していません」に倣う）。
- 全関数 `requireSession()` で auth + companyId スコープ。CREATE/UPDATE/DELETE は AuditLog 記録。

> **`sketchThumbPath` 同期の一元化**: add/delete/reorder の3関数で「`sketchImages` を sortOrder 昇順に並べ、先頭要素の thumbGcsPath（無ければ gcsPath）を `sketchThumbPath` に入れる。0枚なら null」を共通ヘルパーで行い、ズレを防ぐ。

> 配列追記の同時実行: `sketchImages` は配列まるごと更新（last-write-wins）。`addProductSketch` 内で「最新を読み直してから追記」する（findFirst → 配列に push → update）。

---

## 6. 物理削除時の GCS 後始末（✓ 確定・既存方針に整合）

- 実測: `deleteProductPermanently` は 4重ガード（MASTER_ADMIN / ARCHIVED / 確認名一致 / 参照ゼロ）の後 `prisma.product.delete`。**GCS オブジェクトの後始末は無い**。markings の PDF も同様に GCS 残置（`gcs.ts` に delete 関数自体が無い）。
- **B-027 でも GCS 削除は実装しない**（孤児オブジェクト許容＝既存方針に整合）。`deleteProductSketch` も配列から外すだけで GCS は残す。
- 仕様書にこの方針を明記。将来 GCS のライフサイクル管理（孤児掃除）が要るなら別タスク（B-053 系の運用課題として申し送り）。

---

## 7. UI（✓ 確定）

- 新規 `src/app/(app)/products/_components/sketch-section.tsx`（client）。中立型 `src/lib/types/product-sketch.ts` から型 import。
- 構成: 複数画像のグリッド表示（`<img src={signedUrl}>`）＋各画像の削除ボタン＋並び替え＋「＋画像を追加」（`<input type="file" accept="image/*" hidden>` → FormData → `addProductSketch`）。markings の client パターン（`fd.set("file", file)` → server action 直叩き → `router.refresh()`）を踏襲。
- 署名URL は15分で失効するため、ページロード時に `getProductSketchUrls` で取得して表示（再訪時は再取得）。詳細では**原本URL**を `<img>` 表示。
- 配置（✓ 確定）: 現在の section 並びは 基本情報 → 品番分類 → シーズン → 数量納期 → ステータス履歴 → カラー展開 → 数量マトリクス → サンプル製作 → 資材表BOM → マーキング実測 → メタ情報。絵型は **カラー展開の前**（ステータス履歴とカラー展開の間）に1カードとして差し込む。

### 7-2. 一覧サムネ（✓ 確定）

- `src/app/(app)/products/_components/products-table.tsx` に**サムネ列を「品名の左」に1列追加**（`w-[64px]` 程度）。各行で `sketchThumbPath` があれば署名URL化したサムネを小さく表示、無ければプレースホルダ（絵型なしアイコン）。
- これに伴い:
  - `ProductBaseRow`（Pick）に `sketchThumbPath` を追加。
  - `listProducts` の `select` に `sketchThumbPath: true` を追加。
  - 一覧の各行サムネは `sketchThumbPath`（gs://...）を署名URL化する必要がある。一覧は行数ぶん署名URLを発行することになるため、**listProducts 側でまとめて署名URL化して `ProductListItem` に `sketchThumbUrl?: string` を載せて返す**（client で N 回 action を呼ばない）。`getSignedReadUrl` を rows 分 `Promise.all` で回す。

### 7-3. 進行状況確認表（スコープ外・申し送り）

- 進行状況確認表（ProgressTask 系の画面）は現時点で未実装の領域。本タスクでは差し込まない。
- 将来その画面を実装する際、`sketchThumbPath` ＋ 署名URL化（§7-2 と同じ仕組み）を呼ぶだけでサムネを並べられるよう、取得の作法を本タスクで確立しておく（基盤は同一）。

---

## 8. 確定事項（✓ 全て確定）

1. **絵型カードの配置位置（✓）**: **カラー展開の前**（見た目要素を上部にまとめる）。section 並びは 基本情報 → 品番分類 → シーズン → 数量納期 → ステータス履歴 → **【絵型】** → カラー展開 → 数量マトリクス → サンプル製作 → 資材表BOM → マーキング実測 → メタ情報。
2. **粒度（✓）**: 複数枚 Json 配列。各要素は `{ gcsPath, caption?, sortOrder }`（§3）。
3. **許可形式・サイズ上限（✓）**: `image/png` / `image/jpeg` / `image/webp` の3形式・**1枚あたり 5MB 上限**。**HEIC は非対応**（サーバ変換が要るため。iPhone から上げる場合は JPEG 等への変換が前提＝運用で吸収）。
4. **サムネ生成（✓）**: **サーバ生成サムネあり**（sharp・長辺400px・WebP）。一覧表・進行状況確認表で軽いサムネを並べるため（§4-2）。詳細ページは原本を表示。複数サイズ（S/M/L）は作らず 400px の1サイズのみ。
5. **枚数上限（✓）**: 1品番あたり **20枚**。`addProductSketch` のサーバ検証で「既存20枚なら拒否」（暴発防止）。

---

## 9. スコープ境界（✓ 確定）

スコープ内:
- Product への `sketchImages`（Json）＋ `sketchThumbPath`（非正規化）追加（migration 1本）。
- `sharp` 依存追加＋ `serverExternalPackages` に `"sharp"`。サーバ生成サムネ（長辺400px・WebP）。
- 画像 GCS アップロード関数（`uploadProductSketch`・原本＋サムネ2オブジェクト）＋ Server Actions 4関数。
- 中立型 `product-sketch.ts`。
- `sketch-section.tsx`（詳細）＋ page.tsx への差し込み。
- **一覧サムネ列**（products-table.tsx ＋ ProductBaseRow ＋ listProducts select ＋ 一覧用署名URL化）。

スコープ外（別タスク）:
- **進行状況確認表へのサムネ差し込み**（画面が未実装。基盤＝`sketchThumbPath`＋署名URL化は本タスクで用意済み。画面実装時に呼ぶだけ）。
- DesignVersion との統合・三位一体バージョン同期（帳票/マルチペルソナフェーズ）。
- 複数サイズサムネ（S/M/L）・原本の自動圧縮（本タスクは原本そのまま＋400pxサムネの2枚のみ）。
- GCS 孤児オブジェクトのライフサイクル管理（B-053 系運用課題）。
- 縫製仕様書PDF（B-054）への絵型差し込み（最終フェーズ）。
- HEIC 等のサーバ変換。

---

## 10. 次のステップ

1. 本 v1.0 を正として Claude Code 向け実装ブリーフを作成（migration 含む = 本番 DB スキーマ変更。着手前に dev リンク・migration 内容を safety-check）。
2. feature ブランチ `feat/b027-product-sketch` で実装 → 型/lint クリーン → PR open（コードを含むので feature+PR 必須。docs は別途 main 直 push 可）。
3. PR URL 3点セット（①ローカル localhost 確認 / ②マージ=本番反映 / ③本番確認）で進める。**migration 入り PR** なのでデプロイログの「Applying migration ...」行が ③ の本体。
4. 本番確認は「データ依存UI は本番にデータが無いと見えない」罠に注意（PR #85 教訓）。絵型セクションが**データ非依存で表示される**（空でも「絵型」カードと追加ボタンが出る）ことを ③ の確認点にする。
