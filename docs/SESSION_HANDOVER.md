# SESSION_HANDOVER.md（2026-07-20 締め / T-0クローズ・B-078/B-079 本番リリース）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（github.com/shintarokoenuma/shunya-pms / ~/shunya-production-system /
本番 shunya-pms-web-production.up.railway.app）。saagara-v2 とは完全に別物。
★localhost:3000 は saagara-rebuild が使用中。shunya-pms の dev は PORT=3001。
ポートの正体は lsof -nP -iTCP:3001 -sTCP:LISTEN → PID の cwd で確認（HTTP応答だけで判断しない）。

## ① 現在フェーズと完了状態
- フェーズ: 業務トランザクション期・量産軸。spec v1.0 確定済み（07-16・f5c7e38）。
- 今セッション（07-17〜20）の完了事項（すべて main マージ・本番リリース済み）:
  - **T-0（B-071）完全クローズ**: PR #102（21eb16e）＝ WoItem/PoItem 行通貨保存修正
    （Zod＋明細ビルダ＋行通貨UI＋詳細表示・migration なし）。本番監査
    （Railway GUI・shuttle:16099）でヘッダ USD の WO/PO とも 0 件＝本番実害ゼロ確定。
  - **B-078 ナビ改善**: PR #103（97203bd）＝共有パンくず entity-breadcrumb・
    サイドバー現在地ハイライト・セクション別アクセント（master=sky/project=emerald/
    trade=violet・section-accents.ts 集約）・WO/PO 一覧の新規作成＋品番必須ピッカー
    （§4-1(d) 野良伝票禁止）＋検索付きコンボボックス searchable-select.tsx
    （cmdk 導入・品番/サンプル/仕入先/工場/外注先の5種）。
  - **B-078 follow-up**: PR #104（ef258cb）＝サイドバー「取引」見出し追加＋
    アクセント帯 sticky top-16 固定。
  - **B-079 WO 編集画面**: PR #105（9d35005）＝ /work-orders/[id]/edit 新設・
    WorkOrderForm create/edit union・DRAFT のみ編集可（production-axis §2-1 の解消）・
    非 DRAFT は編集ボタン非表示＋/edit 直アクセスは詳細へ redirect・明細行通貨読込。

## ② 未マージ PR
- なし（PR #105 マージ済み 9d35005・ブランチ削除済み・作業ツリークリーン）。

## ③ dev DB の状態
- VERIFY 系（T0/QE1/B78/B79）物理残存 0・完全原状。
- 実データ WO-2026-0004（量産・JPY・50枚×3,000・行通貨 JPY）無傷を生出力確認済み。
- 接続先 dev = hopper.proxy.rlwy.net:12921（railway）。本番 = shuttle:16099（ab6d）。

## ④ ナレッジ登録状況（鉄則4）
- production-axis-spec-confirmation-v1_0-2026-07-16.md 登録済み（検索で現物確認済み）。
- 今セッションの新規 spec/addendum なし（実装セッション）。未同期ゼロ。

## ⑤ 次セッションで最初にやること（優先順）
1. **量産軸 (A) seed① 実装ブリーフ（本丸復帰）**: ProductionEstimate/Item 列定義
   （語彙は RoughEstimate 踏襲）・確定サンプル指定フラグ（新設・1品番1点制約・
   APPROVED を既定候補）・コピー導線（SampleProduction.patternWoId/sewingWoId＋
   PurchaseOrder.sampleProductionId＋WorkOrder.samplProductionId 綴りミス温存）・
   INDIVIDUAL_BILLING は参考表示非計上・migration あり＝triple-gate。
   着手時 design-reread: production-axis v1.0 §1・QE-1R 一式・live schema。
2. B-080: 既存 Select の検索対応（素材ほか・searchable-select.tsx を展開）。

## ⑥ 申し送り・バックログ
- B-065 は PR #94 クローズ済み・(B) に吸収（production-axis §2-5）。
- バックログ: B-072（BOM 行通貨 UI）/B-073（PoAllocation 按分・当面手動）/
  B-074（量産WO明細数量=SKU量産数チェック常時化）/B-075（rollLength 乱）/
  B-076（通貨ソースWO単位化検討）/B-077（初期費用インクルーズ切替）/
  B-080（Select 検索展開・優先度は (A) の後）。
- 編集フォームの通貨追従（ヘッダ一致行のみ追従・手動変更行は保持）は
  慎太郎さん確認済みの意図的仕様。

## ⑦ 本日マージした PR
- PR #102: fix/t0-line-item-currency（T-0 行通貨修正）→ 21eb16e
- PR #103: feat/b078-navigation-improvements（ナビ4点＋検索ピッカー）→ 97203bd
- PR #104: fix/b078-accent-followup（取引見出し＋帯固定）→ ef258cb
- PR #105: feat/b079-wo-edit-page（WO 編集画面）→ 9d35005
※ PR #101（QE-1 量産実績原価・a70f890）は前セッション 07-15 のマージ。

## ⑧ 運用の教訓（恒久ルール化）
- **WO/PO 番号は物理削除で再利用される**（実測: B78VERIFY が削除済み WO-2026-0005 を
  再取得）。→ **本番は物理削除禁止（論理削除のみ）**。物理削除は dev のテストデータ
  後始末に限る。削除対象の特定は番号でなく **title ガード（VERIFY プレフィックス）を正**。
- **UI 削除＝論理削除**。WoItem/PoItem は物理残存する。dev 完全原状は物理削除まで。
- **T-0 以後「行通貨≠ヘッダ通貨」は正当な仕様**。監査クエリ item.currency <>
  header.currency はバグ検出器ではない。今後の監査は生存データ限定＋文脈判断で設計。
- 同一指示の再送は盲目的に再実行せず冪等確認で対応（07-20 実践済み・これを正とする）。
- npm install が未宣言パッケージ（playwright）を prune することがある。検証ツールは
  --no-save で導入し、package.json/lock へのノイズ混入を毎回 diff で確認する。
