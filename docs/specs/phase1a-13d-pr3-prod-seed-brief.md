# Phase 1A-13d 柄種別マスター PR-3（本番投入用エントリ）実装指示書（Claude Code 向け）

- 作成日: 2026-06-01 / Claude.ai
- 目的: 本番 `textile_pattern_types` への投入用エントリ（三重ガード）を**新設する**。
- スコープ: **本 PR は prod エントリの作成のみ。本番 DB への投入（実行）は含まない**（色マスターと違い、ここでは投入しない）。本番投入は PR-3 マージ後・慎太郎さんの明示指示時に、`shunya-environment-safety-check` を全面適用して別ステップで実施する。
- 前提: PR-1（#52）マージ済 → 本番に `textile_pattern_types` テーブルが存在（**中身は空**）。`scripts/seeds/textile-pattern-types-core.ts` に9種別定義と `seedTextilePatternTypes(prisma)` あり。

---

## STEP A: 本番投入用エントリの作成（このPRの対象）

ブランチ: `feat/textile-pattern-type-prod-seed`

`scripts/seed-textile-pattern-types-prod.ts` を新規作成する。

- **`scripts/seed-colors-prod.ts`（PR #51）/ `scripts/seed-cost-categories-prod.ts` と完全に同じ三重ガード構成・同じ引数体系（dry-run / 本投入の切り替え方法を含む）を踏襲**する。**推測で独自のガードを書かない**（前例に揃えることが安全）。
- 中身は `scripts/seeds/textile-pattern-types-core.ts` の `seedTextilePatternTypes(prisma)` を呼ぶだけ。データ・ロジック・冪等性・AuditLog 書き込みは core 側に既にあるので再実装しない。
- dev 専用エントリ `scripts/seed-textile-pattern-types.ts` は「既知の本番ホスト（`shuttle.proxy.rlwy.net:16099`）を含むと abort」（本番を弾く）。prod エントリは**その逆**で、colors-prod / cost-categories-prod と同じ方針（**本番ホスト以外を弾く** / **明示確認フラグ** / **dry-run 既定**）に揃える。
- feature ブランチ → PR → squash merge。
- **このPRは schema 変更なし＝本番 DB 無風。コミット/マージ自体は本番 DB に触れない。**

### 動作確認（このPRで可能な範囲）

- `npx tsc --noEmit` clean。
- prod エントリを **dev 接続のまま実行 → 本番ホスト以外なので abort する**ことを確認（ガードが効くことの確認。dev DB は変更されない）。
- 本番接続での dry-run / 本投入は STEP B（別ステップ）。

---

## STEP B: 本番 DB への投入（★将来・慎太郎さんの明示指示時のみ。本 PR では実行しない）

> このセクションは PR-3 マージ後、慎太郎さんが「本番に投入して」と明示したときに初めて着手する。今は実行しない。

実施時は以下を省略しない（Phase 1A-15 事故の再発防止 / `shunya-environment-safety-check` 全面適用）。

1. **接続先確認**
   - 本番 DB は internal（`postgres-ab6d.railway.internal:5432`）と**公開プロキシ（`shuttle.proxy.rlwy.net:16099`）の2 URL** がある。ローカルから流すのは**公開プロキシ＝`DATABASE_PUBLIC_URL`**（internal は到達不可で abort する）。
   - 接続文字列は**変数経由で取得**（ハードコードしない・シェル履歴に残さない。`read -s` 対話入力 + bash サブシェル）。
   - **ペースト由来の不可視文字対策**: `tr -d '[:space:]'` で除去してから渡す（色投入時にプロトコル検証エラーが出た教訓）。
   - host ↔ 環境の対応は `docs/SESSION_HANDOVER.md` §③ を唯一の正とする。host 完全一致を banner で確認してから yes。

2. **dry-run 先行**
   - colors-prod と同じ dry-run オプションで実行し、**投入予定9件**（SOLID/BD/ST/CK/DT/PR/AO/ML/OT）が表示されることを確認。この段階では実投入しない。

3. **本投入**
   - dry-run の件数・内容に問題がなければ本投入を実行。

4. **投入後検証（read-only）**
   - 本番 `textile_pattern_types`（active）件数 = 9
   - `audit_logs`（`entityType='TextilePatternType' AND action='CREATE'`）= 9
   - SOLID 含む9種別が存在・`sortOrder` 10〜90
   - 本番アプリ `/textile-pattern-types` で9種別が `sortOrder` 昇順・SOLID 先頭で表示

---

## 注意点

- **PR-3 はエントリ作成まで。本番投入は明示指示時に STEP B で**（dry-run 先行・接続先確認を省略しない）。
- seed は冪等（`companyId + typeCode` で既存 skip）。万一の再実行でも重複しない。
- 本番投入後の追加・一括編集は、将来 Phase 1A-14（CSV インポート）の汎用機能でカバー想定。柄種別のために前倒ししない。
- TypeScript はファイル保存（ターミナル直貼り禁止）。main 直コミット禁止。feature ブランチ → PR → squash merge。
- Co-Authored-By は現行のモデル表記に揃える。
