# SESSION_HANDOVER.md（2026-08-02 締め / B-094 完走・B-099・設計追補・B-101/B-096 仕様確認書）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（github.com/shintarokoenuma/shunya-pms / ~/shunya-production-system /
本番 shunya-pms-web-production.up.railway.app）。saagara-v2 とは完全に別物。
★localhost:3000 は saagara-rebuild 使用中。shunya-pms の dev は PORT=3001。
★ローカル確認の第一手順は git branch --show-current。

## ⓪-b 運用ルール追加（2026-08-02・慎太郎さん指示）
**PR を提示するときは毎回、確認用コマンド一式を必ず添える**（省略しない）:

    cd ~/shunya-production-system
    git checkout <branch>
    git pull
    git branch --show-current   # ★対象ブランチであること
    PORT=3001 npm run dev

→ shunya-pr-url-checklist スキルへの恒久追加が必要（未実施・次セッションで対応）。

## ① 現在フェーズと完了状態
- フェーズ: 業務トランザクション期。B-094 縫製指示が本番稼働入り。
  量産進行（B-101/B-096）は仕様確認書 v0.1 まで完了・実装未着手。
- 本セッションで本番リリース:
  - **PR #117（4e08220）**: B-094 縫製指示。migration 44本目
    `20260801000000_sewing_instructions`（triple-gate 3ゲート完走）。
  - **PR #118（cb16234）**: B-099 サンプル製作ラウンドの文言整理。migration なし。
- docs 直 push: 77c730d（reference 2点）→ da21379（B-094 spec v1.0）→
  fc78fbf（production-axis 追補 v0.1）→ 7842810（handover）→ 0d64edf（B-101/B-096 spec v0.1）
- **main HEAD（本メモ時点）: 0d64edf**

## ② 未マージ PR
なし（open 0本）。

## ③ DB の状態
- dev = hopper.proxy.rlwy.net:12921 / 本番 = shuttle.proxy.rlwy.net:16099
- **products.sewing_instructions JSONB NULL** を dev・本番とも適用済み。
  既存行はすべて NULL・件数不変（dev 2件 / 本番 2件）。
- 本番 migration: distinct 44・unfinished 0。schema↔本番DB 乖離ゼロ（empty migration 確認）。
- ~/prod-url-tmp.txt は削除済み（確認済み）。

## ④ ナレッジ登録状況（鉄則4）
本セッション確定 spec（**3本ともプロジェクトナレッジ登録済み**）:
- `b-094-sewing-instruction-spec-confirmation-v1_0-2026-08-01.md`（da21379）
- `production-axis-spec-addendum-v0_1-2026-08-02.md`（fc78fbf）
- `b-101-b-096-production-progress-spec-confirmation-v0_1-2026-08-02.md`（0d64edf）
reference 2点は docs/reference/＋ナレッジ両方に保存済み（77c730d・実体確認済み）。

## ⑤ 次セッションで最初にやること（優先順）
1. **B-101 + B-096 の未確定4点を潰して v1.0 → 実装**。
   spec: `b-101-b-096-production-progress-spec-confirmation-v0_1-2026-08-02.md` §6。
   **机上で議論せず dev で試すのが早い**:
   - §6-4（最優先）: dev で `ALTER TYPE "ProgressTaskType" ADD VALUE 'CUTTING';` を
     BEGIN/ROLLBACK で試し、dry-run が効くか実測。PostgreSQL は同一 tx 内で
     追加した enum 値を直後に使えない制約があるため、triple-gate の形を決める。
   - §6-1: `progress-checklist.tsx`（465行）を全文読み、PRODUCTION 用を
     新規作成するか phase 引数で共用するか決める。
   - §6-3: `generateProductionOrders` が量産 WO に workCategory=PRODUCTION を
     設定しているか live 確認（B-096 のフィルタに効く）。
   - §6-5 / §6-6 は実装しながら決めてよい。
2. **B-054 段1「品番サマリー1枚 PDF」**。B-094 の SEWING_INSTRUCTION_LABELS を流用。
   B-091 ピクトグラムと一貫デザイン。
3. **B-102 リピート系譜**（production-axis 追補 §2 の要件を仕様確認書で詰める）。
4. shunya-pr-url-checklist スキルへの⓪-b 追加。
5. 本番での (B) 量産発注 初生成の立ち会い（実データが揃ってから）。

## ⑥ 本セッションの主要な学び・事故と対策

### 「保存済みと言って保存されていない」事故の原因究明と恒久対策
前セッションのメモに「reference 2点を保存済み」と書いたが、実際には
docs/reference/ に存在せず commit もされていなかった。原因は3つとも構造的:
1. **指示文と本文をコードブロック2つに分けた** → 貼り漏れが物理的に起こる。
   実際に本セッションでも Claude Code が「本文が含まれていません」と聞き返した。
2. **「指示を出した」を「完了した」として転記した** → live 確認を挟んでいない。
3. **バイナリはチャット添付から Claude Code に届かない** → 原本パス未確定のまま指示。
→ **新スキル `file-write-verification` を作成し慎太郎さんが登録済み**。
   鉄則: (1) 1指示=1コードブロック（cat <<'EOF' に本文全文埋め込み）
        (2) 検証コマンド同梱・raw 出力を見るまで「完了」と書かない
        (3) バイナリは Claude.ai 側から present_files で配布（経路A）
   本セッションは全保存で検証4点（ls/wc/git log/unpushed）を確認した。
   ※ ただし本メモ保存時、Claude が「本文は貼り替えてください」とプレースホルダを
     出しかけた。スキルを作った当人が破りかけた＝この失敗は根が深い。次も警戒する。

### migration 検証の環境固有事項
- **`prisma db execute` は prisma.config.ts の都合で `--url` 必須**。
  migration 検証は最初から psql を使うこと。
- **`SHADOW_DATABASE_URL` 未設定**（env・.env とも）。`migrate diff --from-migrations`
  は shadow 必須のため使えない。代替（shadow 不要・静的）:

      git show HEAD:prisma/schema.prisma > /tmp/schema_before.prisma
      npx prisma migrate diff --from-schema-datamodel /tmp/schema_before.prisma \
        --to-schema-datamodel prisma/schema.prisma --script

  → **B-097: shadow DB 整備**として起票。

### 本番 _prisma_migrations の 60 vs 43 は無害（調査済み）
- total 60 / distinct_names 43 / unfinished 0 / rolled_back 0。
- 初期17本が各2回記録された重複（過去の baseline 二重記録）。schema 状態に影響なし。
- `migrate deploy` は migration_name 単位判定のため影響を受けない。
- **起票不要**（当初 B-098 として起票予定だったが取り下げ＝B-098 は欠番）。

### ProductAuditField のコンパイル時ゲート
Product にスカラを足すと `satisfies Record<ProductAuditField, unknown>` が
ビルド失敗する = 「監査に載せるか除外するか必ず決めよ」という意図的な保険。
B-094 では B-027（sketchImages）と同型で **Exclude** を選択。
→ **専用 action の専用 AuditLog が必須**。B-094 では実装済み。

### 設計判断の撤回は spec に残す
PR #115 のコメント「量産ラウンドも含む」を本セッションで撤回した。
引き継ぎメモだけに書くと次に品番カルテを触る際に spec を読んでも出てこないため、
**production-axis 追補 v0.1 として spec に記録**した（「色マスターの轍」対策）。

## ⑦ 本セッションの設計確定

### 量産のラウンド概念（詳細: production-axis-spec-addendum-v0_1）
- **量産に「ラウンド」概念は無い**。PR #115 のコメントを撤回。
- **品番カルテ ⊃ サンプル製作ラウンド群 + 量産1回**。「カルテ＝量産1回分」ではない。
- **追加生産は別 Product 派生**（単純な数量追加も含む）。先方品番は据え置き
  （clientProductCode に一意制約なし）。親子は ProductRepetitionLineage。
- 判断基準は「先方の発注書が別か」ではなく「**原価と納期を別に管理する必要があるか**」。
- リピート時: 仕様・BOM 生地・付属は**コピー**／納期・数量は**ブランク**／
  **コストはコピーではなく参照表示**（値上がり・小ロット割増の見落とし防止）。

### 量産進行（詳細: b-101-b-096-production-progress-spec-confirmation-v0_1）
- **PO/WO は発注までしか表さない**（慎太郎さん指摘）。「届いた・終わった・次に渡した」
  は別の状態＝進行チェックリストが必要。
- 量産の工程は**12行**: FABRIC/TRIM/GRADING/**CUTTING**/SEWING/PROCESSING/
  INSPECTION/**FINISHING**/**PACKING**/SHIPPING/DELIVERY/INVOICE。
- enum 追加は**3値のみ**（CUTTING/FINISHING/PACKING）。テーブル変更なし。
  `WorkOrderType` は変更不要（CUTTING/FINISHING は既存）。
- **`GRADING` は SAMPLE テンプレートに含まれない**（live 確認）→ PRODUCTION 専用にできる。
- 生成トリガー = **`generateProductionOrders` の成功 return 直前**（冪等ガード必須）。
- 一括チェックは**確認ダイアログ付きの提案**（案A′）。未入荷/BLOCKED/SKIPPED は
  既定で外す。「全部 DONE」ボタンは置かない。
- **手動チェック時は evidenceMode を MANUAL に落とす**（自動算出との衝突回避）。
- 権限ガードは **v1 で実装しない**（UserRole ベースのガード実例が src に1件も無い。
  B-022 外部開放と同時設計）。
- 進行セクションは **PRODUCTION 専用**。SAMPLE は SP 詳細のまま。
- B-096 は新規ルート `/progress`・案件セクション。ガント/受け渡し記録は v1 スコープ外。

## ⑧ B-094 の実装内容（完了）
- `Product.sewingInstructions Json? @map("sewing_instructions")`（@db 指定なし）
- 固定5項目: ネーム位置／洗濯ネーム位置／仕上げ方法／製品後加工／下げ札
- 縫製指示6項目: 裏／糸／ステッチ／柄合わせ／差し込み／生地方向
- 候補値は **enum 化しない**（自由入力上書き可・運用で育てる）。
  `src/lib/types/sewing-instruction.ts` に型＋LABELS／OPTIONS／ORDER／EMPTY 定数。
- 差し込みは3値（不可／組合せ／一方向）。現物の「可」「着内一方」は不採用。
- スコープ外: 肩パット／釦穴種別／芯使用箇所／箇所別始末表（version を 2 に上げて追加可）。
- `Specification` モデルは **src 参照ゼロ＝完全休眠**を確認し、相乗りせず Product 新設。
- 配置: BOM → マーキング実測 → 資材所要量 → **縫製指示** → 概算量産見積。

## ⑨ バックログ（本セッション更新分）
- **B-097（新規）**: SHADOW_DATABASE_URL 未設定の整備。
- **B-101（新規・仕様 v0.1 済）**: 量産進行＝品番カルテの「進行」セクション。
- **B-102（新規）**: リピート系譜の実装（ProductRepetitionLineage・コピー機能・
  前回コスト参照表示・ModelCode 累積更新）。
- **B-103（新規）**: 受け渡し記録（現物の移動ログ）。外注先を往復する現物の
  発送・受領を記録しないと進行が推測になる。B-096 v2 と同時期。
- **B-096（仕様 v0.1 済）**: 進行表ボード。B-101 と同時実装。
- **B-099 / B-094**: 完了。
- 既存: B-054 段1 / B-090 / B-091 / B-092 / B-093 / B-089 / B-087 /
  B-072〜B-077 / B-082a/b / B-084 / B-086 / B-023 / B-024 / B-020 / B-065 redesign。
- **B-098 は欠番**（_prisma_migrations 調査の結果、起票不要と判断）。

## ⑩ 本日のコミット
- 77c730d docs: 現場資料2点を reference 保存
- da21379 docs: B-094 仕様確認書 v1.0
- e28fc26 / e52bacc feat(b094)（feature ブランチ）
- 4e08220 PR #117 マージ（B-094 縫製指示）
- 99f4484 / 5719ba0 / 6e48caa fix(b099)（feature ブランチ）
- cb16234 PR #118 マージ（B-099）
- fc78fbf docs: production-axis 追補 v0.1
- 7842810 docs: 引き継ぎメモ（午前分）
- 0d64edf docs: B-101+B-096 仕様確認書 v0.1

---

# 【重要訂正】2026-08-04 追記 — migration は本番デプロイ時に自動適用される

## 判明した事実（実測）

`package.json` の scripts:

    "start": "prisma migrate deploy && next start"

`railway.json` / `railway.toml` / `nixpacks.toml` / `Dockerfile` / `Procfile` は
**すべて未設定** → Railway は nixpacks 既定で `npm start` を使う。
リポジトリ内で `prisma migrate deploy` の記述は**この1箇所のみ**（全体 grep 済み）。

→ **本番コンテナ起動のたびに未適用 migration が自動適用され、その後アプリが起動する。**
→ **PR のマージ = Railway 自動デプロイ = migration 自動適用。**

## これまでの記述は誤りだった

旧メモの triple-gate「dev 適用 → マージ → 本番 dry-run → 本番 `migrate deploy`」は
**順序が誤っている**。マージ後に dry-run を打っても手遅れ。

実証（B-101 PR1 / migration 45）:
- PR #119 を 2026-08-03 にマージ
- 本番 `_prisma_migrations.finished_at` = **2026-08-03 22:57:25 UTC**（マージ後デプロイ時刻）
- マージ後に dry-run を実行 → `ERROR: enum label "CUTTING" already exists`
- `enum_range` は既に **17値**、`distinct_names` は 44 → **45**

今回は enum 追加（非破壊・DML なし）だったため実害ゼロ。
**破壊的 migration だったら検証前に本番へ入っていた。**

`B-094`（migration 44）の「triple-gate 3ゲート完走」という記述も、
`finished_at` = 2026-08-01 15:40 がデプロイ時刻と一致するため、
**3つ目のゲートは実際には no-op（適用済みで何も起きなかった）だった可能性が高い。**

## 正しい 4 ゲート（以後これに従う）

- **ゲート1: dev 適用**
  dev は `_prisma_migrations` を持たない（db push 由来）ため `migrate dev` は使えない
  （drift 検知で reset を要求される）。静的 diff → 手書き migration → psql 適用。

      git show HEAD:prisma/schema.prisma > /tmp/schema_before.prisma
      npx prisma migrate diff --from-schema-datamodel /tmp/schema_before.prisma \
        --to-schema-datamodel prisma/schema.prisma --script

- **ゲート2: 本番 dry-run【★マージ前に実施★】**
  Railway psql Console で `BEGIN` → 対象 SQL → `ROLLBACK`。
  構造と影響行数（0件）を確認。**COMMIT しない。**

- **ゲート3: マージ**
  ★マージ = 自動デプロイ = migration 自動適用。**マージボタンが本番適用ボタン。**

- **ゲート4: 適用結果の確認**
  `_prisma_migrations` の `finished_at` / `applied_steps_count` / `rolled_back_at`
  ＋ 対象オブジェクト（enum 値・カラム等）の実測。

## 是正方針（慎太郎さん確定 2026-08-04）

`start` から `migrate deploy` は**外さない**。外すとデプロイのたびに
コードとスキーマが乖離するリスクが出てかえって危険。
**ゲートの順序を入れ替えることで対処する。**

## 環境の追加事実

- **dev DB には `_prisma_migrations` テーブルが存在しない**（db push 由来）。
  これが `migrate dev` が reset を要求する原因。dev への migration 履歴記録は不要。
  → B-097（SHADOW_DATABASE_URL 整備）と同根の環境課題として扱う。
- **`shunya-pr-url-checklist` スキルが未インストールだった**
  （`~/.claude/skills/` ディレクトリ自体が不在。zip バックアップのみ存在）。
  2026-08-04 に `shunya-backups/archives/` から復元し、4ゲート節を追記（113→147行）。
  → **他のスキルも消えている可能性がある。棚卸しが必要（未実施）。**

## B-101 PR1 の状態（完了）

- PR #119 マージ済み（**d81c8de**）。migration 45 適用済み・`rolled_back_at` NULL。
- 本番 enum 17値。本番 `progress_tasks` は SAMPLE 25 のみ（PRODUCTION 未生成＝正常）。
- dev 実測: PRODUCTION タスク11行・冪等ガード実証（2 PE 生成でも11行のまま）・SAMPLE 58 無傷。
- 次: PR2（進行セクション UI）→ PR3（自動算出）。

## 残っている宿題

- **⓪-b の スキル追記**（PR 提示時の確認コマンド一式）— 今回も未実施。
- **スキルの棚卸し**（他スキルの存在確認・必要なら復元）。
- **B-086 の再定義**: PDF は全て「全ページプレビュー確認 → 承認後 DL」に変更
  （慎太郎さん指示 2026-08-04）。対象は見積 PDF・発注 PDF・PE 見積 PDF など全 PDF 導線。
- **同一品番の生地が PO 生成時に合算されるか**の確認（慎太郎さん質問 2026-08-04・未調査）。
