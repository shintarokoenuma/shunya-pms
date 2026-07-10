# Phase 1A-13c 色マスター 本番 seed 投入 指示書（Claude Code 向け）

- 作成日: 2026-06-01 / Claude.ai
- 目的: **本番 `colors` テーブル（現在空）に確定51色（`00` 含む）を投入**する
- 重要: これは **本番 DB（`shuttle.proxy.rlwy.net:16099`）への書き込み操作**。shunya-environment-safety-check を全面適用する。

---

## 前提

- PR-1（#49, schema + migration）マージ済 → 本番に `colors` テーブルが存在（**中身は空**）。
- PR-2（#50, UI + `00` seed）マージ済 → `scripts/seeds/colors-core.ts` に `00` を含む51色定義あり。
- 本投入は **seed（手動操作）**。デプロイ時の `prisma migrate deploy`（PR #44）とは別物。migrate はスキーマだけ、データは入らない。

---

## STEP A: 本番投入用エントリの作成（Claude Code）

`scripts/seed-colors-prod.ts` を新規作成する。

- **`scripts/seed-cost-categories-prod.ts` と完全に同じ三重ガード構成・同じ引数体系（dry-run / 本投入の切り替え方法を含む）を踏襲**する。推測で独自のガードを書かない（前例に揃えることが安全）。
- 中身は `scripts/seeds/colors-core.ts` の `seedColors(prisma)` を呼ぶだけ。データ・ロジック・冪等性・AuditLog 書き込みは core 側に既にあるので再実装しない。
- dev 専用エントリ `scripts/seed-colors.ts` は「既知の本番ホストを含むと abort」（本番を弾く）。prod エントリはその逆で、cost-categories-prod と同じ方針（本番ホスト以外を弾く／明示確認フラグ／dry-run 既定）に揃える。
- feature ブランチ → PR → squash merge。

---

## STEP B: 本番 DB への投入（慎太郎さん実行）★本番 DB 書き込み

以下を省略しない。順番どおり実施する。

1. **接続先確認**
   - 本番 DB（`shuttle.proxy.rlwy.net:16099`）に対する操作であることを確認する。
   - 接続文字列は cost-categories 本番投入と同じ「変数経由で取得」する方式（ハードコードしない。シェル履歴に残さない）。
   - host ↔ 環境の対応は `docs/SESSION_HANDOVER.md` §③ を唯一の正とする。

2. **dry-run 先行**
   - cost-categories-prod と同じ dry-run オプションで実行し、**投入予定51件**（`00` 含む）が表示されることを確認する。この段階では実投入しない。

3. **本投入**
   - dry-run の件数・内容に問題がなければ本投入を実行する。

4. **投入後検証（read-only）**
   - 本番 `colors` 件数 = 51
   - `audit_logs`（`entityType='Color' AND action='CREATE'`）の整合
   - `00`（カラー未定）が入っていること
   - 本番アプリ `/colors` で51色が `sortOrder` 昇順に表示され、`00` が先頭の斜線チップで出ること

---

## 注意点

- **dry-run 先行・接続先確認を省略しない**（Phase 1A-15 事故の再発防止）。
- seed は冪等（`companyId + colorNumber` で既存 skip）。万一の再実行でも重複しない。
- 本番投入後の追加・一括編集は、将来 Phase 1A-14（CSV インポート）の汎用機能でカバーする想定。色のために CSV 機能を前倒ししない。
- TypeScript はファイル保存（ターミナル直貼り禁止）。main 直コミット禁止。feature ブランチ → PR → squash merge。
- Co-Authored-By は現行のモデル表記に揃える。
