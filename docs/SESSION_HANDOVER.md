# SESSION_HANDOVER.md（2026-08-09 締め / バックログ台帳3点セット構築・スキル改訂・追補 v1.2）

## ⓪ 次セッションの最初の一手

**B-108 PR2a（引き当て元5列の migration・triple-gate）に着手する。**
仕様は確定済み（追補 v1.2 まで）。設計の議論は不要で、そのまま実装ブリーフを書ける状態。

ただし**ブリーフを書く前に dev の現況確認を挟むこと**（§④参照）。

---

## ① 今セッションで完了したこと（コード変更ゼロ・docs のみ）

### バックログ台帳を3点セットで構築（構造的課題の解消）

B-060 以降の定義が、毎セッション上書きされる SESSION_HANDOVER.md の本文に
**しか存在しない**状態だった。次の上書きで失われる寸前。

git 履歴 66 コミットからの機械抽出で復旧し、役割を分離した。

| ファイル | 役割 | 更新方式 | commit |
|---|---|---|---|
| docs/BACKLOG_EVIDENCE.md | 不変アーカイブ（2,932行） | **編集・再生成の禁止** | c1700c4 |
| docs/BACKLOG.md | 運用台帳（B-001〜124 ＋ 別表） | **差分更新のみ** | 32e9151 |
| docs/SESSION_HANDOVER.md | 状態の復元 | 全文上書き | 本コミット |

**★Claude.ai は本文を一切書いていない。** 証跡を持つ Claude Code に原文を読ませて
書かせた。記憶で書けば捏造になるため。この方式を今後も維持すること。

### 台帳の確定事項

- **欠番は4件: B-042 / B-068 / B-098 / B-100。再採番禁止。**
  B-042 は「tx timeout は v1.2 PR に同梱済のため起票せず」と証跡に明記されていた
  （公式リストに無い4つ目として発見）。
- **B-070 = 移管。** 専用プロジェクト「shunya-請求書インテーク(B-070)」へ移管済みで
  本体の実装対象外。証跡外の情報のため定義欄に出所を明記。
- **状態欄は証跡の明示語からのみ判定する。** 実態と食い違っても解釈で上書きせず、
  実態は定義欄に併記する。B-065（実態は「(B)に吸収・クローズ」だが状態=保留）、
  B-124（実態は「記録済・是正未決」だが状態=保留）、B-096（状態=未着手だが
  仕様確認書 v1.0 は確定済・関連doc 欄で判別可）が該当。

### ★B-125 の回収（構造的な穴の発見）

台帳作成中、B-003 の定義が Claude.ai の記憶と食い違った。証跡を確認すると
記憶側の内容（Material の参考サイト URL）は**証跡に一切存在しなかった**。

慎太郎さん確認の結果、**チャットで合意されたが B-番号を振られず repo に一度も
書かれなかった要件**と判明。台帳作成の副産物として偶然回収された。

→ B-125 として**別表「チャット由来（repo 証跡なし）」に起票**。本表とは出所が
   違うため混ぜない。B-003 には触れていない。

B-125: Material マスターに仕入先の参考サイト URL を保持し、生地/ボタン/ファスナー/
付属のカテゴリ別に整理して表示する。目的は**現物の見本帳が無くてもオンラインで
資料が揃う状態**。生地メーカー・ボタンメーカー・YKK 等のリンクを素材に紐づける。

recon 結果: Material の URL 列は画像用のみ（imageUrl / swatchImageUrl）で
参考サイト列は未実装。Supplier.website は既存だが粒度が異なる。**新規列追加が必要。**

### shunya-session-handover スキルを改訂（鉄則5・6 を新設）

- **鉄則5**: BACKLOG.md は差分更新のみ・全文上書き厳禁。
  BACKLOG_EVIDENCE.md は編集・再生成禁止。
- **鉄則6**: 番号を振っていない合意の洗い出し。B-125 の取りこぼしが根拠。
- 締め時に必ず書く1行を必須化:
  「B-番号 増減：新規○件／状態変更○件／取り下げ○件／番号未採番の合意○件」
  **ゼロ件でも書く（沈黙の禁止）。**
- 禁止事項に追加: **確認コマンドの結果を先取りした文案を指示文に埋め込まない。**

### b-108 PR2 仕様確認書に追補 v1.2（commit 1009f5d）

v1.1 §C-4「PR2a で本番に触れるのは migration のみ」が
**triple-gate の免除と誤読されうる**ため訂正。
取り消されたのは v1.0 §6-1（品番 null count）のみ。
**PR2a の本番接続は2回（ゲート2 マージ前 dry-run / ゲート4 実測）。いずれも省略不可。**

---

## ② 現在の状態

- **main HEAD = 1009f5d**。作業ツリーは docs のみ変更でクリーン。
- 本セッションは **docs のみ。コード・schema・DB は一切変更していない。**
- コミット4本: c1700c4（証跡） → 32e9151（台帳） → 1009f5d（追補v1.2） → 本メモ
- `?? skill/` が未追跡で存在（スキル zip の展開物）。B-037（未追跡ファイル整理）の
  管轄。放置で問題なし。
- dev サーバ PID 37285（2026-08-07 15:24 起動）。**生存未確認。次セッション冒頭で確認。**

---

## ③ プロジェクトナレッジ登録状況

### 登録済み（本セッション）
- b-101-b-096-production-progress-spec-confirmation-v1_0-2026-08-03.md（前回からの持ち越しを解消）

### ★差し替えが必要（未実施なら次セッション冒頭で実行）
- b-108-pr2-allocation-ui-spec-confirmation-v0_1-2026-08-08.md
  → **中身が v1.2 になっている。** ファイル名は v0_1 のまま（house style）。
     差し替えないと次セッションの Claude.ai が誤解を招く表現を読む。

### 登録不要
- BACKLOG.md / BACKLOG_EVIDENCE.md は repo 運用のため登録不要。
  ただし Claude.ai は repo を読めないので、台帳の内容を尋ねる際は
  Claude Code に grep させること。

---

## ④ 次の実装（PR2a → PR2b → PR2c）

### ★ブリーフ着手前の dev 現況確認（必須）

1. `git log origin/main --oneline -5` で HEAD が 1009f5d 以降か
2. `DeliveryNoteItem` に5列が未追加であることの再確認
3. dev サーバ PID 37285 の生存確認
4. dev DB に `_prisma_migrations` が無いこと（db push 由来）の再確認

### PR2a: migration（引き当て元5列・triple-gate 厳守）

    sourceSampleProductionId  String?  @map("source_sample_production_id")
    sourceWoItemId            String?  @map("source_wo_item_id")
    sourceWorkOrderId         String?  @map("source_work_order_id")
    sourcePoItemId            String?  @map("source_po_item_id")
    sourcePurchaseOrderId     String?  @map("source_purchase_order_id")

すべて nullable・index 付与・@relation なし・backfill 不要。

**★列ごとの役割を混同しないこと**

| 列 | 安定性 | 用途 |
|---|---|---|
| sourceSampleProductionId | 安定 | **フィルタ可** |
| sourceWoItemId / sourcePoItemId | 不安定（親編集で dead） | 行特定・best-effort |
| sourceWorkOrderId / sourcePurchaseOrderId | 安定 | **バッジのみ・フィルタ不可** |

**triple-gate（追補 v1.2 で明確化）**
- ゲート1 dev: 手書き SQL → migrate diff で empty-diff 検証 → **dev サーバ再起動**
- ゲート2 **本番・★マージ前★**: dry-run（BEGIN → DDL → 行数実測 → ROLLBACK）
- ゲート3 マージ（= 自動デプロイ = 自動適用）
- ゲート4 本番: 実測（5列の存在確認・行数確認）

dev DB には `_prisma_migrations` が無い（db push 由来）ため `migrate dev` は使えない。
additive-only だが migration である以上 triple-gate は厳守。

### PR2b: 引き当て UI（3タブ・一括追加）＋ 漏れ検知フィルタ

- 写経元は AddProcessingDialog（samples/_components/progress-checklist.tsx）
- **★round-trip 検証を受け入れ条件に含める**
  「引き当て → 保存 → 編集画面を開く → 無変更で保存 → 引き当て元が残るか」
  updateDeliveryNote が明細を作り直すため、hidden で5列を持ち回らないと静かに消える
- 実装前に **dev 検証データの投入が必要**:
  wo_items / po_items の INDIVIDUAL_BILLING が dev に **0件**でタブ2 が検証できない

### PR2c: カルテ内セクション ＋ SAMPLE_TASK_TEMPLATE の DELIVERY 行

- ⑭発注（ProductOrdersSection・#orders）の直後に delivery-note-section.tsx を新設
- { DELIVERY, sortOrder: 90, isReceived: null } を追加。enum 既存のため migration 不要
- AUTO_FROM_DOC_TASK_TYPES には含めない（自動算出は B-106）

---

## ⑤ バックログ（今セッションの増減）

**新規 1件／状態変更 1件／取り下げ 0件／番号未採番の合意 0件**

- **B-125**（新規・別表）: Material の参考サイト URL をカテゴリ別に表示
- **B-070**（状態変更）: 状態不明 → 移管

以後、バックログの定義は `docs/BACKLOG.md` が唯一の台帳。
**このメモに定義を書かない。** メモは上書きされるため。

---

## ⑥ 本セッションの教訓

### 検証コマンドの設計ミスが3回（すべて Claude.ai 側の不備）

1. 証跡アーカイブに `TODO|XXX` の混入チェックをかけた
   → 過去ログの原文に「TODO：」があり必ずヒットする。危険なのは
     「ここに貼り付け」だけ。**前セッション⑥と同じ失敗の再発。**
2. `seq -w 1 60` が幅2桁を生成 → 3桁ゼロ埋めは `printf 'B-%03d\n'`
3. 確認コマンドの**結果を先取りした文案**を指示文に埋め込んだ
   → 「列が無ければ『未実装』と書く」と渡したが実際は画像URL列が存在。
     Claude Code が板挟みになり停止・確認が必要になった。

いずれも Claude Code が誤検知/矛盾と判定して正しく処理した。**スキルに禁止事項として
記録済み。**

### 記憶と証跡が食い違ったとき、証跡を正とした判断が新しい要件を回収した

B-003 で Claude.ai の記憶が証跡と食い違った。design-reread の原則どおり
**doc を正として記憶で上書きしなかった**結果、「記憶側の内容はどこから来たのか」
という問いが立ち、B-125 の回収につながった。

**記憶で上書きしていれば、B-003 の定義を壊したうえで B-125 も失われていた。**

### 「抜けやすさ」は重要度ではなく機械判定できるかで決まる

慎太郎さんの指摘。ナレッジ登録が抜けにくいのはファイル名が明示され目に見えるから。
バックログ更新が抜けやすいのは「気をつける」に依存し沈黙で飛ばせるから。
→ 対策は検証コマンドの出力による判定。**ゼロ件でも「ゼロ件」と出力させる。**

---

## ⑦ 環境（変更なし）

- dev DB = hopper.proxy.rlwy.net:12921 / 本番 DB = shuttle.proxy.rlwy.net:16099
- 本番 URL = shunya-pms-web-production.up.railway.app
- dev サーバは PORT=3001（localhost:3000 は saagara-rebuild 用）
- 本番 migration: 46本適用済み・pending なし（2026-08-08 デプロイログで確認）
