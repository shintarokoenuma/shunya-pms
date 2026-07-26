# (B) 量産発注生成 仕様確認書 v0.1 (2026-07-26)

- 種別: 仕様確認書 v0.1（確定・実装ブリーフ着手可）
- 対象: 量産軸 (B) 量産発注生成（保存済み量産見積 → SKU 数量入力 → 仕入先別 PO／
  工場別 WO の DRAFT 生成）＋ B-083 調達区分（同時設計）
- 上位/関連: production-axis v1.0 §2（Q-d/Q-e 確定の具体化）／ B-083（2026-07-18 起票）／
  B-074（整合チェック・(B) と同時）／ B-079（WO DRAFT 編集・実装済み PR #105）／
  T-0（前提タスク・完了済み PR #102・dev/本番監査 0 件）
- 現物確認: 2026-07-22 recon（ProductionEstimateItem に supplierId/factoryId 非実在・
  materialId/costCategoryId/sourcePoItemId/sourceWoItemId 実在）

---

## 0. 前提の充足状況

- T-0（行通貨保存）: 完了（§2-4 の前提クリア）。
- WO DRAFT 編集: B-079 で実装済み（§2-1 の open question 解消済み）。
- (A) 量産見積: PR #106/#107 で本番稼働・B-080 でマスターピッカー整備済み。
- PO の DRAFT 編集画面の有無は実装ブリーフ段の recon で確認（無ければ同 PR で整備）。

## 1. 生成の種と起動（R-b 確定）

- **保存済み量産見積（PE）を種にする。PE の無い品番での直接生成は v1 では不許可。**
  PE 作成は seed① コピーで軽く、直接生成を許すと見積なし発注が常態化して
  (C) 突合の前提が崩れるため。PE 不在時は「先に量産見積を作成してください」の導線を出す。
- 起点: 品番カルテ・量産見積セクションの PE 行（および PE 詳細）の「量産発注を生成」
  ボタン。種にする PE は人が明示選択（既定の推しは最新の PE）。Q-d の「最新版」は
  自動判定ではなく明示選択＋既定提示で実装する。

## 2. 相手先（仕入先/工場）の導出（R-a 確定）

- **PE Item に相手先列は追加しない。生成時に導出する。** 導出順:
  1. sourcePoItemId → 元サンプル PO の仕入先／sourceWoItemId → 元 WO の相手先
     （seed① コピー行は元伝票の相手先が業務上の真値）
  2. 取れない行（MANUAL 行等）: MATERIAL は Material.primarySupplierId をフォールバック
  3. それも無ければ生成画面で人が指定（未指定行が残る間は生成実行不可）
- 生成画面では全行の相手先を編集可能（§2-1 の下書き原則: 機械が既定値・人が最後に整える）。
- WO 側の相手先列の現物名（factoryId/subcontractorId 等）は実装ブリーフ段の recon で確定。

## 3. 調達区分 procurementRoute — B-083（R-c 確定）

- **enum ProcurementRoute { COMPANY_ARRANGED / CLIENT_SUPPLIED / STOCK_ALLOCATED } を新設**
  （全明細行共通の直交軸として設計・将来 PoItem/WoItem/BomItem と共有する前提の命名）。
- **v1 の列は ProductionEstimateItem.procurementRoute のみ**（@default(COMPANY_ARRANGED)・
  既存行は default により挙動不変・backfill 不要）。PoItem 以降への展開は後続 PR
  （生成パイプラインが値を運ぶだけの構造にしておく）。
- PE フォームに区分選択を追加し、行に区分バッジを表示（COMPANY_ARRANGED は無印可）。
- **分子計上: COMPANY_ARRANGED のみ 1枚単価の分子に計上。** CLIENT_SUPPLIED /
  STOCK_ALLOCATED の行は削除せず温存・分子から除外・バッジで明示
  （支給品・引き当て品の「単価空→計上外」運用を区分として正式化）。
- (B) の生成判定キー: **COMPANY_ARRANGED の行のみ伝票化**（MATERIAL→PO・LABOR→WO）。
  CLIENT_SUPPLIED / STOCK_ALLOCATED は生成対象外（支給・引き当てに発注は立たない）。
- 在庫引き当ての実在庫参照（在庫マスター接続）は将来段。v1 の STOCK_ALLOCATED は
  区分と計上制御のみ。
- enum 追加につき Record<enum,string> のラベル定義を同一 PR で追加（鉄則）。

## 4. 生成画面と数量（R-d 確定）

- 数量入力は **SKU（カラーウェイ×サイズ）単位**。Sku.productionQuantity を既定値として
  提示し、生成時に入力値を焼き込む（SKU への固定参照にしない・§1-8 と同思想）。
- **Σ入力数量 ≠ PE.estimateQuantity は警告表示のみでブロックしない**
  （見積数量と受注確定数量のずれは正常な業務）。
- 内部整合は厳守: **生成される量産 WO の全工程明細数量 = Σ入力数量**（§2-2）。
  生成パイプラインがこれを保証し、B-074（以後の編集への整合チェック常時化）を
  (B) と同時に実装する。

## 5. 生成物（R-e 確定）

- **PO**: 仕入先別に 1 本（DRAFT）。対象は COMPANY_ARRANGED の MATERIAL 行。
  - **PoItem.productColorwayId を新設**（Q-e・PR #94 クローズ済み方針の正方向実装）。
    生地行はカラーウェイ別に明細を分割し、数量は PE の量ロジックを色別数量で再計算
    （用尺 × 色別量産数 × (1＋ロス率)・ROLL/METER 分岐・カット代は METER のみ）。
  - カラーウェイ共通の付属行は productColorwayId = null 許容。
  - 単価・通貨は PE 行のコピー（T-0 済みのため行通貨は正しく保存される）。
- **WO**: 工場/外注先別に 1 本（DRAFT・WorkOrderCategory = PRODUCTION）。
  対象は COMPANY_ARRANGED の LABOR 行。全工程明細数量 = Σ入力数量。
- **初期費用は生成しない**（§2-1 確定・isSeparateBilling=true の別枠行は生成対象外。
  再製版は人が明示起票）。
- PO/WO とも品番直結（productId 必須・野良伝票禁止 B-078 踏襲）。(C) の
  「品番直結 PO の実額合計」の前提になる。

## 6. 生成後の遷移（R-f 確定）

- 生成完了後は**品番カルテへリダイレクト**し、生成された DRAFT の PO/WO が
  一覧で見える状態にする（PO 作成後遷移のバックログ論点を本件に収載）。
- 生成物は DRAFT であり、人が編集して確定する（WO は B-079 済み・PO は §0 の recon 次第）。

## 7. migration（triple-gate 対象）

1. enum ProcurementRoute 新設
2. ProductionEstimateItem.procurementRoute（@default(COMPANY_ARRANGED)）
3. PoItem.productColorwayId（String?・index）
- 手書き SQL ＋ migrate diff（empty-diff 検証）方式。dev 確認 → 本番 dry-run
  （BEGIN/ROLLBACK・psql タブ）→ 本番 migrate deploy。

## 8. スコープ外

- procurementRoute の PoItem/WoItem/BomItem への列展開（後続 PR）
- 実在庫の引き当て参照（在庫系接続・将来段）
- 受注（SO）モデル・自動トリガー（起動は人がボタン・§4 踏襲）
- PO 実額の品番按分（B-073・当面手動）

## 9. 確定一覧

| # | 論点 | 確定内容 |
|---|---|---|
| R-a | 相手先導出 | PE Item に列追加せず生成時導出（元伝票→primarySupplier→人指定）・生成画面で全行編集可 |
| R-b | 直接生成 | v1 不許可・PE 必須・作成導線を案内 |
| R-c | B-083 スコープ | enum 新設＋v1 は PE Item のみ・COMPANY_ARRANGED のみ分子計上＋伝票化 |
| R-d | 数量とずれ | SKU 単位入力・既定=Sku.productionQuantity・Σ≠分母は警告のみ・WO 工程数量=Σ入力は厳守 |
| R-e | グルーピング | 仕入先別 PO／工場別 WO（PRODUCTION）・colorway 分割・初期費用非生成 |
| R-f | 遷移 | 生成後は品番カルテへ |

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-07-26 | v0.1 | 初版確定。R-a〜R-f を推奨案で確定（相手先導出／PE 必須／B-083 v1 スコープ／数量警告方式／グルーピング／遷移先）。migration 3 点を確定 |
