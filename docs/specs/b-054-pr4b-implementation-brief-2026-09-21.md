# 実装ブリーフ — B-054 PR-4b 縫製仕様書 PDF 2枚目（採寸用）・3枚目（加工工場用）

- 作成日: 2026-09-21 23:45 JST（date 取得）/ claude.ai
- 元になる仕様: v1.0（D-1〜D-21）／addendum v0.1〜v0.4（D-22〜D-55）。★紙面は addendum v0.4 D-45〜D-55 が正
- 参考画面: 2・3枚目プレビュー v10.1 https://claude.ai/artifact/GZ13r7krnnaf4kWVtQXcE8 （慎太郎さん「うん、これで行ってみよう。」2026-09-21 23時台）
- 起点 commit: e5179ff（2026-09-21 23:43 JST 実測・main clean・open PR 0・dev hopper:12921）
- ライフサイクル: 5（仕様書）／8（量産発注＝工場へ渡す帳票）
- schema 変更: **なし**（migration なし）

---

## 0. 実測（2026-09-21 23:43 JST・read-only）

| # | 実測 | 帰結 |
|---|---|---|
| 1 | 4a（8d33149）は6ファイル: route.ts 51 / sewing-spec-data.ts 454 / sewing-spec-document.tsx 498 / sewing-spec-format.ts 121 ＋ test 105 / render.tsx +9 | 4b はこの6ファイルの延長。新ファイルは原則作らない |
| 2 | route.ts はクエリを `parseSewingSpecPages`（format.ts）で解析し、measure / process は unsupported → 400 | **解析の形（D-35）は変えない**。measure / process を受け付けるようにするだけ |
| 3 | document の部品: Cell / ColorCell / SkuMatrix / AccessoryTable / ColorSpecTable / HeaderBlock / MainPage / ContinuationPage / buildPhysicalPages / SewingSpecDocument。定数 B4_JIS・TABLE_FONT_SIZE 9・ROW_MIN_HEIGHT 13・BLOCK_GAP 5 | HeaderBlock は3枚共通で再利用。帯だけ2段に直す |
| 4 | Brand: brandCode / brandName / brandNameEn? / deletedAt。Product.brandId（必須）・productName（必須） | ブランド＝Brand.brandName（手動 join・companyId で絞る） |
| 5 | WorkOrderType 14値。表示名は `src/lib/constants/work-order-types.ts` の `WORK_ORDER_TYPE_LABELS`（PRINTING=プリント・WASHING=洗い・加工・INSPECTION=検品） | 3枚目の「加工」はこのラベル |
| 6 | dev の WO: SEWING×PRODUCTION 10 / SEWING×SAMPLE 3 / PRINTING×SAMPLE 3 / CUTTING×PRODUCTION 2 / PATTERN_MAKING×PATTERN 1。**INSPECTION は 0** | 2枚目の検品宛ては dev 確認の前にデータ投入が要る |
| 7 | 絵型を持つ品番は AOI-26SS-M-TS-001（3枚）だけ | 3枚目の2×2（4枚）の確認には絵型を1枚足す |

## 1. 変えること

### 1-1. クエリ（sewing-spec-format.ts）
- measure / process を受け付ける。形は D-35 のまま（`page=<kind>:<woId>[:<sortOrder>,…]`・出現順・最大10）
- 画像の数の上限: sewing は 4a のまま／**measure は2つまで**（1つ目＝採寸位置の絵型・2つ目＝サイズ表の画像）／**process は4つまで**。超えたら 400
- 省略時: measure・process とも「sortOrder が最小の絵型を1つ」（4a の sewing と同じ規則）
- 同じ sortOrder の重複は 400
- テスト（sewing-spec-format.test.ts）に measure / process の正常系・上限超え・重複を足す

### 1-2. 宛先 WO の条件（sewing-spec-data.ts・D-34）
- 共通: 同じ companyId・deletedAt が null・productId がその品番
- sewing: workType = SEWING（4a のまま）
- measure: workType ∈ { SEWING, INSPECTION }
- process: workType ∈ { PRINTING, EMBROIDERY, WASHING, DYEING, FINISHING }
- 条件を満たさなければ 4a と同じく 400「宛先の作業発注が条件を満たしません」

### 1-3. 品番の帯（HeaderBlock・D-47）★1枚目にも効く
- 2段にする。1段目＝品番（14pt 太字）＋品名（productName・11pt 太字・1行で「…」）。2段目＝ブランド（Brand.brandName）・先方品番・パターンNO・型紙
- 空の値は「—」（D-32 と同じ）
- 1枚目の絵型の高さが約 12pt 減る（残りの高さいっぱいの作りのまま）

### 1-4. 2枚目 採寸用（MeasurePage・D-51 / D-52）
- 表題「縫製仕様書（採寸用）」＋区分の札（D-28）
- 並び: 表題 → 宛先枠・弊社枠 → 帯 → **数量・仕様（左右2列）** → 採寸位置の絵型（1つ目の画像） → サイズ表の画像（2つ目の画像・残りの高さいっぱい）
- 数量は D-27 と同じ出し分け（PRODUCTION＝SKU の色×サイズ表＋「この発注 N 枚」／それ以外＝N 枚だけ）。1枚目の SkuMatrix を再利用
- 仕様は縫製指示のうち3項目だけ: 仕上げ方法（finishingMethod）・製品後加工（postProcessing）・生地方向（fabricDirection）。ラベルは SEWING_INSTRUCTION_LABELS
- 画像の高さ配分: 画像が2つのとき、絵型は固定高さ（目安 230pt）・サイズ表の画像が残り。**画像が1つだけなら、その絵型が残りの高さいっぱい**
- 付属・色ごとの指定は出さない

### 1-5. 3枚目 加工工場用（ProcessPage・D-53 / D-54）
- 表題「縫製仕様書（加工工場用）」＋区分の札
- 並び: 表題 → 宛先枠・弊社枠 → 帯 → **加工指示** → **画像を2列で並べる（残りの高さいっぱい）**
- 加工指示の3行: 「加工」＝WORK_ORDER_TYPE_LABELS[workType]／「数量」＝「この発注 N 枚」（WO 明細の quantity の合計）／「位置・版・色」＝「絵型と追加画像のとおり」
- 画像の並べ方: 1枚＝全面／2枚＝左右／3〜4枚＝2×2（3枚のときは右下が空く）。クエリの順に左上から。画像の大小の区別はしない
- 加工工場が複数なら、process を工場（WO）ごとに繰り返す（D-5）

### 1-6. 共通
- ページ番号は出力した全ページ（付属のつづきを含む）で通し（D-33）
- ご担当は主担当がいなければ行を省く（D-18・D-55）
- 希望納期は太字（D-39）
- 画像は loadSketchForPdf を使う（WebP 不可・EXIF・透過の処理済み）。画像を残りの高さに収めるのは `height: 0, flexGrow: 1, flexShrink: 1, objectFit: "contain"`（shunya-pdf-document スキル §1）
- Page に wrap={false} を付けない。JIS B4 は B4_JIS 定数
- 固定文言に ※ ～ ① ℃ ㎝ を使わない（同梱フォントに無い・B-208）

## 2. 範囲外
- 出力ダイアログ（4c）
- サイズ表の器（B-039）・型紙枚数（B-146）・芯使用箇所と部位ごとの縫製注意点（締めで新規起票）
- フォントの差し替え・分綴の「-」（B-208）

## 3. 検証
- 触ったファイルの tsc / lint がクリーン。全体 lint は既存の件数から増えない
- sewing-spec-format.test.ts が通る
- dev（localhost:3001）での試し刷りは PR を作ったあと。必要なデータ（INSPECTION の WO 1件・PRINTING の WO が AOI の品番に付いているか・4枚目の絵型）は environment-safety-check を通して入れる
- 確認する組み合わせ: ①sewing＋measure＋process を1本の URL で（ページ番号が通しになる）②measure の画像1つ／2つ ③process の画像1／2／3／4枚 ④1枚目の帯が2段になっても1枚目が1ページに収まる

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-09-21 | 新規。23:43 の read-only 実測（§0）とプレビュー v10.1 への承認を反映 |

END-OF-BRIEF-B054-PR4B
