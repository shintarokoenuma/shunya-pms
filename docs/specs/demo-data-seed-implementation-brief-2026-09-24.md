# デモ用データ投入（インスタ宣伝用）実装ブリーフ v1.0（2026-09-24）

- 出典: メモ受信箱 M-032（慎太郎さん 2026-09-24）
- 対象環境: ★**dev のみ**（hopper.proxy.rlwy.net:12921）。本番は一切触らない
- BACKLOG: 未起票（締めで採番する）
- ライフサイクル上の位置: 横断（宣伝用。業務フローの機能追加ではない）

## 0. 目的

システムの宣伝として、インスタグラムに載せる画面キャプチャを撮る。
撮る画面は **品番カルテ・見積 PDF・縫製仕様書・請求書・入力画面**（慎太郎さん回答）。
dev に、見栄えのする架空のクライアント・工場・品番を足す。

## 1. 確定事項

| # | 内容 |
|---|---|
| D-1 | ★既存の dev データ（名前に［ダミー］が付いた検証用一式）には**触らない**。デモ用は別コードで横に足す。既存行の UPDATE / DELETE は禁止 |
| D-2 | 発行元は株式会社shunya のまま（宣伝のため） |
| D-3 | 名前はすべて架空（下表）。★名前に［ダミー］や [DEMO] は付けない（写真に写るため）。デモ行の識別はコード（§2）で行う |
| D-4 | ★**スクリプトで入れるもの**: マスター・品番・色・サイズと数量・BOM・縫製仕様の中身。★**画面から手入力するもの**: 量産見積→見積 PDF、納品書→請求書、絵型のアップロード（採番と金額計算が action の中にしか無いため。手入力の工程は「入力画面」の撮影を兼ねる） |
| D-5 | 請求書 PDF は未実装（B-109 PR-4）。今回撮れるのは `/invoices/[id]` の画面まで |
| D-6 | 絵型は Claude が線画を描いて PNG で渡し、画面からアップロードする（`addProductSketch` の正規経路を通す。GCS へ直接書かない） |
| D-7 | シードは dev 専用・冪等（コードで get-or-create）・`--dry-run` 付き。`scripts/seed-dev-sample-data.ts` のホストガードと get-or-create の作法を踏襲する |

### 名前（慎太郎さん承認・2026-09-24）

| 役割 | コード | 名前 | 世界観 |
|---|---|---|---|
| クライアント | CL-003 / ブランド ETB | ÉTÉ BLANC（エテ・ブラン） | リネン中心のフレンチカジュアル |
| クライアント | CL-004 / ブランド HNK | HINOKI WORK SUPPLY（ヒノキ ワーク サプライ） | 日本のワークウェア |
| クライアント | CL-005 / ブランド SLC | SLOW CURRENT（スロウ カレント） | 街着寄りのアウトドア |
| 縫製工場（海外） | FC-003 | Saigon Linen Works | ホーチミンの布帛工場 |
| 縫製工場（国内） | FC-004 | 瀬戸内ソーイングラボ | 岡山のデニム・ワーク系 |
| 生地仕入先 | SP-003 | 遠州テキスタイル工房 | 綿・リネンの機屋 |
| 付属仕入先 | SP-004 | Brass & Bone Trims | ボタン・金具・ラベル |

★コードは Phase 0 で既存の最大値を実測してから確定する（CL-003 等が既に使われていたら止まって報告）。
★ブランドコードは `^[A-Z0-9]+$`（validators/brand.ts）。

### 品番の案（6型・シーズン 27SS）

| ブランド | 型 | 工場 | 位置づけ |
|---|---|---|---|
| ÉTÉ BLANC | リネン開襟シャツ | Saigon Linen Works | ★**作り込む1品番**（全セクションを埋める） |
| ÉTÉ BLANC | リネンワイドパンツ | Saigon Linen Works | 見積・請求の明細を増やす |
| HINOKI WORK SUPPLY | カバーオール | 瀬戸内ソーイングラボ | 縫製仕様書の2例目 |
| HINOKI WORK SUPPLY | ペインターパンツ | 瀬戸内ソーイングラボ | 一覧の賑やかし |
| SLOW CURRENT | フリースプルオーバー | Saigon Linen Works | 一覧の賑やかし |
| SLOW CURRENT | ナイロンショーツ | Saigon Linen Works | 一覧の賑やかし |

- 色は既存の Color マスター（51件）から選ぶ。1品番あたり3〜4色
- サイズは S / M / L / XL。数量は実務らしい数字（合計300〜800枚程度）
- 売値・コストは架空だが自然な水準にする（写真に写るため）

## 2. Phase 0: recon（read-only・コード変更なし）★ここで止まって報告する

目的: 撮る画面が実際に読む列を特定し、空欄が写らないように何を埋めるかを決める。
★モデル名・列名を推量で grep しない。ファイルを開いて読む。

1. 品番カルテ `src/app/(app)/products/[id]/page.tsx` と、そこから呼ばれるセクション部品・action を辿り、表示に使う **model.column の一覧**を作る
2. `src/lib/pdf/sewing-spec-data.ts` と `src/app/api/products/[id]/sewing-spec/route.ts` が読む列を一覧にする（`Product.sewingInstructions` の JSON の形を含む）
3. `src/lib/pdf/pe-quotation-data.ts`（量産見積の見積 PDF）が読む列を一覧にする
4. `/invoices/[id]` と `/invoices/new`・納品書の作成画面が必須とする入力を一覧にする
5. 品番の作成 action（`src/lib/actions/products.ts` の create 系）を読み、**作成時の副作用**を列挙する
   - 例: ProgressTask の自動生成、ProductStatusHistory、AuditLog、ModelCode の採番
   - ★シードがこれを再現しないとカルテの進行欄が空になる
6. `computeNextProductCode`・`computeNextModelCode` の採番規則を読み、デモ品番のコードを**同じ規則で**生成できるか確認する
7. 色・サイズ数量・BOM の作成 action を読み、必須列と連動（Sku の生成・BomItemColorway 等）を列挙する
8. 既存コードの最大値を実測する（Client / Brand / Factory / Supplier / Material のコード）

### Phase 0 の報告の形

| 画面 | model.column | 既存 dev に値があるか | 埋める経路（シード／画面） |
|---|---|---|---|

加えて、品番作成の副作用の一覧と、採番規則の要約。★**報告したら止まる。** Phase 1 は Claude（claude.ai 側）のレビュー後に着手する。

## 3. Phase 1: シードの実装（Phase 0 のレビュー後）

- 新規ファイル `scripts/seed-dev-demo-data.ts`（既存の seed-dev-sample-data.ts は変更しない）
- ホストガード: 本番ホスト（shuttle.proxy.rlwy.net:16099）を検知したら常に abort。期待 dev ホスト以外も abort
- テナント: MASTER_ADMIN を動的解決（既存シードと同じ）
- 冪等: コード（clientCode / brandCode / factoryCode / supplierCode / materialCode / productCode 等）で get-or-create。2回流しても件数が増えない
- `--dry-run`: 作る予定の件数と名前だけ出して DB に書かない
- ★既存行の UPDATE / DELETE をしない
- 品番作成の副作用（Phase 0 の 5）は、action と同じ結果になるよう再現する。再現できないものは報告して Claude の判断を仰ぐ
- 最後にサマリ（モデルごとの created / skipped）を出す

### Git

- `scripts/` はコードのため **feature ブランチ + PR**（main 直 push 禁止）
- 触ったファイルの型チェック・lint がクリーンなら、commit → push → PR open まで自走してよい。マージは慎太郎さん
- ★dev への実投入は、`--dry-run` の出力を慎太郎さんが確認してから

## 4. Phase 2: 画面からの手入力（慎太郎さん操作・撮影を兼ねる）

1. 絵型のアップロード（Claude が描いた PNG）
2. 量産見積: リネン開襟シャツ＋リネンワイドパンツ → 見積 PDF
3. 縫製仕様書 PDF: リネン開襟シャツ・カバーオール
4. 納品書 → 合計請求書（ÉTÉ BLANC 宛て）→ `/invoices/[id]` の画面

## 5. スコープ外

- 本番へのデモデータ投入
- 請求書 PDF（B-109 PR-4）
- 既存［ダミー］データの改名・削除

## 6. 停止条件

- 接続先が dev でない
- デモ用に予定したコードが既に使われている
- 品番作成の副作用が action と同じ形で再現できない
- 画面が読む列のうち、シードでも画面でも埋める経路が無いものがある
