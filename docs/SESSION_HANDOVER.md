# SESSION_HANDOVER.md（2026-08-02 締め / B-094 縫製指示 完走・B-099・設計追補）

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
- 本セッションで本番リリース:
  - **PR #117（4e08220）**: B-094 縫製指示。migration 44本目
    `20260801000000_sewing_instructions`（triple-gate 3ゲート完走）。
  - **PR #118（cb16234）**: B-099 サンプル製作ラウンドの文言整理（3コミット・
    見出し／ボタン／コメント）。migration なし。
- docs 直 push: 77c730d（reference 2点）→ da21379（B-094 spec v1.0）→ fc78fbf（追補 v0.1）
- **main HEAD（本メモ時点）: fc78fbf**

## ② 未マージ PR
なし（open 0本）。

## ③ DB の状態
- dev = hopper.proxy.rlwy.net:12921 / 本番 = shuttle.proxy.rlwy.net:16099
- **products.sewing_instructions JSONB NULL** を dev・本番とも適用済み。
  既存行はすべて NULL・件数不変（dev 2件 / 本番 2件）。
- 本番 migration: distinct 44・unfinished 0。schema↔本番DB 乖離ゼロ（empty migration 確認）。
- ~/prod-url-tmp.txt は削除済み（確認済み）。

## ④ ナレッジ登録状況（鉄則4）
- 本セッション確定 spec:
  - `b-094-sewing-instruction-spec-confirmation-v1_0-2026-08-01.md`（da21379）
  - `production-axis-spec-addendum-v0_1-2026-08-02.md`（fc78fbf）
- **上記2本のプロジェクトナレッジ登録が必要**（B-094 spec は登録済みか要確認）。
- reference 2点は docs/reference/＋ナレッジ両方に保存済み（77c730d・実体確認済み）。

## ⑤ 次セッションで最初にやること（優先順）
1. **B-101 + B-096 の同時設計**（量産進行）。ProgressTask phase=PRODUCTION は
   箱だけあって未実装。品番カルテのステータス履歴セクションを「進行」セクションに
   拡張する方向（追補 §3）。B-096 進行表ボードと同じ ProgressTask を参照するため
   必ず同時設計。着手時に仕様確認書。
2. **B-054 段1「品番サマリー1枚 PDF」**。B-094 の縫製指示を載せる前提で Json 形・
   ラベル定数を設計済み（SEWING_INSTRUCTION_LABELS を流用）。B-091 と一貫デザイン。
3. **B-102 リピート系譜**（追補 §2 の要件を仕様確認書で詰める）。
4. shunya-pr-url-checklist スキルへの⓪-b 追加。
5. 本番での (B) 量産発注 初生成の立ち会い（実データが揃ってから）。

## ⑥ 本セッションの主要な学び・事故と対策

### 「保存済みと言って保存されていない」事故の原因究明と恒久対策
前セッションのメモ④⑤-4 に「reference 2点を保存済み」と書いたが、実際には
docs/reference/ に存在せず commit もされていなかった。原因は3つとも構造的:
1. **指示文と本文をコードブロック2つに分けた** → 貼り漏れが物理的に起こる。
   実際に本セッションでも Claude Code が「本文が含まれていません」と聞き返した。
2. **「指示を出した」を「完了した」として転記した** → live 確認を挟んでいない。
3. **バイナリはチャット添付から Claude Code に届かない** → 原本パス未確定のまま指示。
→ **新スキル `file-write-verification` を作成し慎太郎さんが登録済み**。
   鉄則: (1) 1指示=1コードブロック（cat <<'EOF' に本文全文埋め込み）
        (2) 検証コマンド同梱・raw 出力を見るまで「完了」と書かない
        (3) バイナリは Claude.ai 側から present_files で配布（経路A）
   本セッションはこのスキルに従い、全保存で検証4点（ls/wc/git log/unpushed）を確認した。

### migration 検証の環境固有事項
- **`prisma db execute` は prisma.config.ts の都合で `--url` 必須**。
  migration 検証は最初から psql を使うこと。
- **`SHADOW_DATABASE_URL` 未設定**（env・.env とも）。`migrate diff --from-migrations`
  は shadow 必須のため使えない。代替: `--from-schema-datamodel`（shadow 不要・静的）で
  「変更前 schema → 変更後 schema」の差分 SQL を出し、手書き SQL と突き合わせる。
  実際の手順:
      git show HEAD:prisma/schema.prisma > /tmp/schema_before.prisma
      npx prisma migrate diff --from-schema-datamodel /tmp/schema_before.prisma \
        --to-schema-datamodel prisma/schema.prisma --script
  → **B-097: shadow DB 整備**として起票（型変更・制約追加を伴う migration で必要になる）。

### 本番 _prisma_migrations の 60 vs 43 は無害（調査済み）
- total 60 / distinct_names 43 / unfinished 0 / rolled_back 0。
- 初期17本（20260516_init 〜 20260528_add_material_category_status_level_indexes）が
  各2回記録された重複。過去の baseline 二重記録。schema 状態に影響なし。
- `migrate deploy` は migration_name 単位判定のため影響を受けない
  （実際 B-094 の1本のみ適用された）。
- **起票不要**（当初 B-098 として起票予定だったが取り下げ）。

### ProductAuditField のコンパイル時ゲート
Product にスカラを足すと `satisfies Record<ProductAuditField, unknown>` が
ビルド失敗する = 「監査に載せるか除外するか必ず決めよ」という意図的な保険。
B-094 では B-027（sketchImages）と同型で **Exclude** を選択。
→ **専用 action の専用 AuditLog が必須**。B-094 では updateSewingInstructions に実装済み。

## ⑦ 本セッションの設計確定（詳細は追補 v0.1 を参照）
- **量産に「ラウンド」概念は無い**。PR #115 のコメント「量産ラウンドも含む」を撤回。
- **品番カルテ ⊃ サンプル製作ラウンド群 + 量産1回**。「カルテ＝量産1回分」ではない。
- **追加生産は別 Product 派生**（単純な数量追加も含む）。先方品番は据え置き
  （clientProductCode に一意制約なし）。親子は ProductRepetitionLineage。
- 判断基準は「先方の発注書が別か」ではなく「**原価と納期を別に管理する必要があるか**」。
- リピート時: 仕様・BOM 生地・付属は**コピー**／納期・数量は**ブランク**／
  **コストはコピーではなく参照表示**（値上がり・小ロット割増の見落とし防止）。

## ⑧ B-094 の実装内容（完了）
- `Product.sewingInstructions Json? @map("sewing_instructions")`（@db 指定なし）
- 固定5項目: ネーム位置／洗濯ネーム位置／仕上げ方法／製品後加工／下げ札
- 縫製指示6項目: 裏／糸／ステッチ／柄合わせ／差し込み／生地方向
  （※当初5項目だったが「裏」を追加して6項目で確定）
- 候補値は **enum 化しない**（自由入力上書き可・運用で育てる）。
  `src/lib/types/sewing-instruction.ts` に型＋LABELS／OPTIONS／ORDER／EMPTY 定数。
- 差し込みは3値（不可／組合せ／一方向）。現物の「可」「着内一方」は不採用。
- スコープ外: 肩パット／釦穴種別／芯使用箇所／箇所別始末表。Json なので後から追加可
  （追加時は version を 2 に上げる）。
- `Specification` モデル（stitchSpec 等）は **src 参照ゼロ＝完全休眠**を確認し、
  相乗りせず Product 新設を選択（B-027 の前例に揃える）。
- 配置: BOM → マーキング実測 → 資材所要量 → **縫製指示** → 概算量産見積。

## ⑨ バックログ（本セッション更新分）
- **B-097（新規）**: SHADOW_DATABASE_URL 未設定の整備。
- **B-101（新規）**: 量産進行＝ステータス履歴セクションの「進行」セクション化。
  B-096 と同時設計。
- **B-102（新規）**: リピート系譜の実装（ProductRepetitionLineage・コピー機能・
  前回コスト参照表示・ModelCode 累積更新）。
- **B-099**: 完了（PR #118）。
- **B-094**: 完了（PR #117）。
- 既存: B-054 段1 / B-090 / B-091 / B-092 / B-093 / B-096 / B-089 / B-087 /
  B-072〜B-077 / B-082a/b / B-084 / B-086 / B-023 / B-024 / B-020 / B-065 redesign。
- **B-098 は欠番**（_prisma_migrations 調査の結果、起票不要と判断）。

## ⑩ 本日のコミット
- 77c730d docs: 現場資料2点を reference 保存
- da21379 docs: B-094 仕様確認書 v1.0
- e28fc26 feat(b094): schema + 中立型（feature ブランチ）
- e52bacc feat(b094): UI + 専用action（feature ブランチ）
- 4e08220 PR #117 マージ（B-094）
- 99f4484 / 5719ba0 / 6e48caa fix(b099)（feature ブランチ）
- cb16234 PR #118 マージ（B-099）
- fc78fbf docs: production-axis 追補 v0.1
