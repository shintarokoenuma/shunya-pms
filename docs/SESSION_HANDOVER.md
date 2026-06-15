# 引き継ぎメモ (2026-06-15 セッション3 / B-064 出荷・Claude Code 権限設定導入)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット（shunya-pr-url-checklist スキル準拠）
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)。コード含むPRは必須。
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)。
- ③ マージ後=本番URL + デプロイログ目視（migration入りは Applying migration 行）。
- 【2026-06-15 追加】型・lint クリーンなら commit→push→PR open まで Claude Code 自走可。人が握るのは①ローカル目視と②マージの2点のみ。

## ① 本セッションの成果
- B-064 数量マトリクス表示を実装・PR #82 でマージ済み・本番反映確認済み（スクショで空状態表示OK）。スキーマ変更なし・migration なし・read-only。
- Claude Code 権限設定を導入（.claude/settings.local.json・shunya-pms 専用・gitignore 済み）。狭め allow / main直push は ask / 危険操作(.env・add -A・force push・reset --hard・rm -rf)は deny。
- スキル2件更新（shunya-pr-url-checklist に「PR open まで自走」追記・shunya-git-workflow を同期）。慎太郎さんがアップロード済み想定。

## ② 確定事項（前セッションからの継続・1ページ構想）
- 北極星=製品概要1ページ。実装順 = B-064(済) → ③+B-062 β → B-063 色名供給 → B-027 絵型。
- 決定2: BOM は Product 直結を正系に・Specification 経由は option（破壊的 migration なし・specificationId optional 化のみ）。現 nullability 未確認。
- 決定4: Material.availableColors を {colorNumber自社, supplierColorCode先方C/#結合キー必須, supplierColorName任意} へ（Json=migration不要）。Color に colorNameEn 追加。B-063 スコープ大（色マスター未 build なら確定+build 内包 / Sku 色 FK 化 Phase 1B 前倒し）。
- B-064 の発見（addendum v0.3）: SKU は生成導線なし・dev/本番とも0件。Sku 数量群は量産ライフサイクル（指定数=orderedQuantity / 取り切り=productionQuantity）。サンプルは SP で別系統。希望数は対応列なし・出どころ未定(saagara-v2/CSV/先方)→別タスク。

## ③ Railway環境（唯一の正）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099（migrate deploy・_prisma_migrations あり）
- dev DB postgres-development/hopper:12921（db push・_prisma_migrations 無し・migrate系打たない）
- migration 31本（本セッションで増減なし）。GCS dev=...-dev / prod=...-prod。

## ④ dev DB（hopper:12921・変化なし）
- bom_items=5 / po_items=5 / skus=0。テスト品番 AOI-26AW-CUT_SEWN-001（id 7671eb90-4bc8-46e0-996b-2e119550be80）温存。

## ⑤ 次セッション優先順
1. ③+B-062 β（付属マトリクス＝カラーウェイ×資材色）の設計。着手前に spec 読み直し（v0.1 §2・§4 / v0.2 決定2・決定4 / addendum v0.3）→ live grep: Bom.specificationId/productId の現 nullability・BomItem 現フィールド（supplierItemCode/designCode/sizeValue/sizeUnit/usagePerUnit/unit/colorCode/colorName の有無）・調達カラーの持ち方（カラーウェイ別の新テーブル or BomItem JSON）。migration あり＝三重ガード。③(BOM寄せ)は B-062 の最初のサブステップ。
2. B-063 色名供給。着手前 live grep: model Color の存在・build 状況・colorNameEn の有無・Sku 色列の現状。未 build なら色マスター確定+build を内包。
3. B-027 絵型（最後・画像アップロード基盤・GCS 既存）。
4. B-060 SPタイトルは方針①で次の SP 作業に相乗り。

## ⑥ 1ページ傘下 backlog
- B-064 数量マトリクス表示=完了(#82) / B-062 β / B-063 色名解決 / B-027 絵型
- B-061(C)=不要クローズ / B-060(B=SPタイトル)=方針①で相乗り
- 継続: B-048 / WorkOrder編集UI / B-037 / SKU 生成導線（希望数の出どころ確定後・別タスク）
- QE-1 は北極星完了後（Excel2点を参照資料化・再添付依頼。QE-1 仕様書は Specification 経由 BOM 前提で古い=決定2に合わせ見直し）。B-057 は QE-1 後。逆転記(A)不要確定。

## ⑦ 本日マージされた PR / push
- PR #82: B-064 数量マトリクス表示（squash 12d03b8・マージ済み・本番反映確認済み）。
- main 直 push: 817b12e（.gitignore に .claude/settings.local.json 追加）。
- main 先頭: 817b12e → 12d03b8 → 456bf0d。
- docs: addendum v0.3 は前セッション(456bf0d)で記録済み。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. shunya-design-reread スキルで B-062 の spec を読み直してから設計（記憶で組み立てない・色マスターの轍）
3. git log origin/main --oneline -5 で先頭が 817b12e か確認
4. ⑤-1（B-062 β 設計・spec 読み直し→live grep）から着手
